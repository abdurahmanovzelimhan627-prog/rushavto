#!/usr/bin/env python3
"""Локальный сервер: раздаёт сайт, сохраняет заявки в SQLite и пересылает их в Telegram-бота."""
import http.server
import json
import os
import secrets
import sqlite3
import urllib.parse
import urllib.request
import urllib.error

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(DIRECTORY, ".env")
DB_PATH = os.path.join(DIRECTORY, "leads.db")


def load_env():
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    return env


def ensure_admin_token():
    env = load_env()
    token = env.get("ADMIN_TOKEN")
    if token:
        return token
    token = secrets.token_urlsafe(24)
    with open(ENV_PATH, "a", encoding="utf-8") as f:
        f.write(f"\nADMIN_TOKEN={token}\n")
    print(f"[server] Сгенерирован ADMIN_TOKEN, сохранён в .env: {token}")
    print(f"[server] Список заявок: http://localhost:8080/admin.html?token={token}")
    return token


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            name TEXT,
            phone TEXT,
            country TEXT,
            model TEXT,
            body_type TEXT,
            year TEXT,
            exterior_color TEXT,
            interior_color TEXT,
            budget TEXT,
            source TEXT,
            telegram_ok INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(leads)")}
    for col in ("body_type", "year", "exterior_color", "interior_color"):
        if col not in existing_cols:
            conn.execute(f"ALTER TABLE leads ADD COLUMN {col} TEXT")
    conn.commit()
    conn.close()


def save_lead(data):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        """
        INSERT INTO leads (created_at, name, phone, country, model, body_type, year, exterior_color, interior_color, budget, source, telegram_ok)
        VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """,
        (
            str(data.get("name", "")).strip(),
            str(data.get("phone", "")).strip(),
            str(data.get("country", "")).strip(),
            str(data.get("model", "")).strip(),
            str(data.get("bodyType", "")).strip(),
            str(data.get("year", "")).strip(),
            str(data.get("exteriorColor", "")).strip(),
            str(data.get("interiorColor", "")).strip(),
            str(data.get("budget", "")).strip(),
            str(data.get("source", "")).strip(),
        ),
    )
    lead_id = cur.lastrowid
    conn.commit()
    conn.close()
    return lead_id


def mark_telegram_sent(lead_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE leads SET telegram_ok = 1 WHERE id = ?", (lead_id,))
    conn.commit()
    conn.close()


def fetch_leads():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM leads ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def send_via_bot(token, chat_id, text):
    if not token or not chat_id:
        return False, "токен или chat_id не заданы"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            if body.get("ok"):
                return True, None
            return False, body.get("description", "Неизвестная ошибка Telegram API")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
            return False, body.get("description", str(e))
        except Exception:
            return False, str(e)
    except Exception as e:
        return False, str(e)


def send_to_telegram(text):
    env = load_env()
    return send_via_bot(env.get("TELEGRAM_BOT_TOKEN_2"), env.get("TELEGRAM_CHAT_ID_2"), text)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/leads":
            query = urllib.parse.parse_qs(parsed.query)
            token = (query.get("token") or [""])[0]
            admin_token = load_env().get("ADMIN_TOKEN")
            if not admin_token or token != admin_token:
                self._send_json(401, {"ok": False, "error": "неверный или отсутствующий token"})
                return
            self._send_json(200, {"ok": True, "leads": fetch_leads()})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/lead":
            self._send_json(404, {"ok": False, "error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            self._send_json(400, {"ok": False, "error": "bad json"})
            return

        try:
            lead_id = save_lead(data)
        except Exception as e:
            print("Не удалось сохранить заявку в БД:", e)
            self._send_json(500, {"ok": False, "error": "не удалось сохранить заявку"})
            return

        lines = ["\U0001F697 Новая заявка с сайта RUSHAUTO"]
        field_labels = [
            ("name", "Имя"),
            ("country", "Направление"),
            ("model", "Марка/модель"),
            ("bodyType", "Тип кузова"),
            ("year", "Год выпуска"),
            ("exteriorColor", "Цвет кузова"),
            ("interiorColor", "Цвет салона"),
            ("budget", "Бюджет"),
            ("phone", "Телефон"),
            ("source", "Источник"),
        ]
        for key, label in field_labels:
            value = str(data.get(key, "")).strip()
            if value:
                lines.append(f"{label}: {value}")
        text = "\n".join(lines)

        ok, error = send_to_telegram(text)
        if ok:
            mark_telegram_sent(lead_id)
        else:
            print("Telegram send failed (заявка всё равно сохранена в БД):", error)

        # Заявка уже сохранена в БД, поэтому отвечаем клиенту успехом
        # даже если пересылка в Telegram не удалась — данные не потеряны.
        self._send_json(200, {"ok": True})

    def end_headers(self):
        if self.path == "/rushauto_standalone.html":
            self.send_header("Content-Disposition", 'attachment; filename="rushauto.html"')
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[server]", fmt % args)


if __name__ == "__main__":
    init_db()
    admin_token = ensure_admin_token()
    port = 8080
    with http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler) as httpd:
        print(f"RUSHAUTO server running: http://0.0.0.0:{port}")
        print("Заявки формы -> POST /api/lead -> сохранение в leads.db + пересылка в Telegram")
        print(f"Просмотр заявок: http://localhost:{port}/admin.html?token={admin_token}")
        httpd.serve_forever()
