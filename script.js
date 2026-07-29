// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const burger = document.getElementById('burger');
const mainNav = document.getElementById('mainNav');
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

// Scroll progress bar
const routeFill = document.getElementById('routeFill');
function updateProgress() {
  const scrollTop = window.scrollY;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const pct = height > 0 ? (scrollTop / height) * 100 : 0;
  routeFill.style.width = pct + '%';
}
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

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

// Quote form -> WhatsApp with prefilled message
const quoteForm = document.getElementById('quoteForm');
quoteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const country = document.getElementById('qCountry').value;
  const model = document.getElementById('qModel').value.trim();
  const budget = document.getElementById('qBudget').value.trim();
  const name = document.getElementById('qName').value.trim();

  let lines = ['Здравствуйте! Хочу подобрать автомобиль.'];
  lines.push('Направление: ' + country);
  if (model) lines.push('Марка/модель: ' + model);
  if (budget) lines.push('Бюджет: ' + budget);
  if (name) lines.push('Меня зовут: ' + name);

  const text = encodeURIComponent(lines.join('\n'));
  window.open('https://wa.me/79280899174?text=' + text, '_blank', 'noopener');
});
