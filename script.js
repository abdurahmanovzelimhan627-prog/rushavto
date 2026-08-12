// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile nav toggle
const burger = document.getElementById('burger');
const mainNav = document.getElementById('mainNav');
if (burger && mainNav) {
  burger.addEventListener('click', () => {
    const open = mainNav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
  });
  mainNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mainNav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    });
  });
}

// Scroll progress bar
const routeFill = document.getElementById('routeFill');
if (routeFill) {
  const updateProgress = () => {
    const scrollTop = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    routeFill.style.width = pct + '%';
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

// Reveal on scroll
const revealTargets = document.querySelectorAll(
  '.dir-card, .timeline-stage, .case-card, .adv-card, .faq-item, .quote-form, .quote-copy'
);
revealTargets.forEach(el => el.classList.add('reveal'));

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealTargets.forEach(el => io.observe(el));

// Quote form -> Telegram (backend)
const quoteForm = document.getElementById('quoteForm');
if (quoteForm) {
  const qSubmit = document.getElementById('qSubmit');
  const qStatus = document.getElementById('qStatus');
  const qConsent = document.getElementById('qConsent');

  // Кнопка отправки заблокирована, пока не отмечен чекбокс согласия —
  // блокировка отправки без согласия обязательна, поле не предзаполнено.
  qConsent.addEventListener('change', () => {
    qSubmit.disabled = !qConsent.checked;
  });

  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const website = document.getElementById('qWebsite').value;
    const country = document.getElementById('qCountry').value;
    const model = document.getElementById('qModel').value.trim();
    const bodyType = document.getElementById('qBodyType').value;
    const year = document.getElementById('qYear').value.trim();
    const exteriorColor = document.getElementById('qExteriorColor').value.trim();
    const interiorColor = document.getElementById('qInteriorColor').value.trim();
    const budget = document.getElementById('qBudget').value.trim();
    const name = document.getElementById('qName').value.trim();
    const phone = document.getElementById('qPhone').value.trim();

    qSubmit.disabled = true;
    qStatus.textContent = 'Отправляем заявку...';

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website, country, model, bodyType, year, exteriorColor, interiorColor, budget, name, phone, source: 'quote-form' }),
      });
      const data = await res.json();
      if (data.ok) {
        qStatus.textContent = 'Заявка отправлена менеджеру. Мы скоро свяжемся с вами.';
        quoteForm.reset();
      } else {
        qStatus.textContent = 'Не получилось отправить заявку (' + (data.error || 'сервер недоступен') + '). Попробуйте ещё раз или напишите нам в WhatsApp.';
      }
    } catch (err) {
      qStatus.textContent = 'Сервер недоступен. Попробуйте ещё раз или напишите нам в WhatsApp.';
    } finally {
      // После reset() чекбокс снова снят — кнопка должна остаться
      // заблокированной, а не просто разблокироваться безусловно.
      qSubmit.disabled = !qConsent.checked;
    }
  });
}

// Cookie-баннер: сторонние трекеры (Метрика/Analytics) запускаются
// только через enableTrackers(), которая вызывается исключительно
// после активного согласия пользователя (клик «Принять») — либо сразу
// при загрузке, если согласие уже было дано раньше.
const COOKIE_CONSENT_KEY = 'rushauto_cookie_consent';

function enableTrackers() {
  // Здесь подключаются сторонние счётчики (Яндекс.Метрика, Google Analytics
  // и т.п.), когда они появятся. До вызова этой функции такие скрипты
  // на сайт не добавляются и не выполняются.
}

const cookieBanner = document.getElementById('cookieBanner');
if (cookieBanner) {
  const cookieAccept = document.getElementById('cookieAccept');
  if (localStorage.getItem(COOKIE_CONSENT_KEY) === '1') {
    enableTrackers();
  } else {
    cookieBanner.classList.add('is-visible');
  }
  cookieAccept.addEventListener('click', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, '1');
    cookieBanner.classList.remove('is-visible');
    enableTrackers();
  });
}
