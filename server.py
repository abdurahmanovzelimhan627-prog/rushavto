#!/usr/bin/env python3
"""Локальный сервер: раздаёт сайт и принимает заявки из формы -> пересылает в Telegram-бота."""
import http.server
import json
import os
import urllib.request
import urllib.error

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(DIRECTORY, ".env")


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


def send_to_telegram(text):
    env = load_env()
    token = env.get("TELEGRAM_BOT_TOKEN")
    chat_id = env.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False, "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заполнены в .env"

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


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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

        lines = ["\U0001F697 Новая заявка с сайта RUSHAUTO"]
        field_labels = [
            ("name", "Имя"),
            ("country", "Направление"),
            ("model", "Марка/модель"),
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
            self._send_json(200, {"ok": True})
        else:
            print("Telegram send failed:", error)
            self._send_json(502, {"ok": False, "error": error})

    def end_headers(self):
        if self.path == "/rushauto_standalone.html":
            self.send_header("Content-Disposition", 'attachment; filename="rushauto.html"')
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[server]", fmt % args)


if __name__ == "__main__":
    port = 8080
    with http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler) as httpd:
        print(f"RUSHAUTO server running: http://0.0.0.0:{port}")
        print("Заявки формы -> POST /api/lead -> Telegram")
        httpd.serve_forever()
