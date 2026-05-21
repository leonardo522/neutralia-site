// Anno corrente nel footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Menu mobile toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// Header: aggiungi classe "scrolled" quando si scrolla
const header = document.querySelector('.site-header');
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  if (currentScroll > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
  lastScroll = currentScroll;
}, { passive: true });

// ============================================
// MODAL — apertura/chiusura + form email PDF
// ============================================
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('is-open');
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const firstInput = m.querySelector('input[type="email"]');
  if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

function closeModal(m) {
  m.classList.remove('is-open');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // Reset stato
  m.querySelectorAll('.modal-state').forEach((s, i) => {
    s.hidden = i !== 0;
  });
  const form = m.querySelector('form');
  if (form) form.reset();
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-modal]');
  if (opener) {
    e.preventDefault();
    openModal(opener.dataset.openModal);
    return;
  }
  const closer = e.target.closest('[data-close-modal]');
  if (closer) {
    const m = closer.closest('.modal-overlay');
    if (m) closeModal(m);
    return;
  }
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-overlay.is-open');
    if (open) closeModal(open);
  }
});

// ============================================
// INSTAGRAM FEED — Behold.so
// ============================================
// Quando crei il feed su https://behold.so, ti viene generato un URL pubblico
// tipo: https://feeds.behold.so/XXXXXXXXX
// Sostituisci qui sotto. Lascia stringa vuota per usare solo il fallback statico.
const BEHOLD_FEED_URL = 'https://feeds.behold.so/b1nAJf39h8WrQslhIhzg';

async function loadInstagramFeed() {
  const grid = document.getElementById('ig-feed');
  if (!grid) return;

  let posts = null;
  try {
    if (BEHOLD_FEED_URL) {
      const res = await fetch(BEHOLD_FEED_URL);
      if (res.ok) {
        const data = await res.json();
        posts = (data.posts || []).slice(0, 6).map(p => ({
          permalink: p.permalink,
          thumbnailUrl: p.thumbnailUrl || p.mediaUrl,
          mediaType: p.mediaType,
          isReel: p.isReel,
          captionShort: (p.caption || '').split('.')[0].slice(0, 80)
        }));
      }
    }
  } catch (err) {
    console.warn('Behold fetch failed, using fallback:', err);
  }

  if (!posts) {
    try {
      const res = await fetch('assets/data/instagram.json');
      const data = await res.json();
      posts = data.posts;
    } catch (err) {
      console.error('Instagram fallback failed:', err);
      return;
    }
  }

  grid.innerHTML = posts.map(p => `
    <a href="${p.permalink}" target="_blank" rel="noopener" class="ig-post" aria-label="${p.captionShort || 'Post Instagram'}">
      ${p.thumbnailUrl ? `<img src="${p.thumbnailUrl}" alt="" loading="lazy">` : '<div class="ig-post-empty"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></div>'}
      <div class="ig-post-overlay">
        <span class="ig-post-icon" aria-hidden="true">${p.mediaType === 'VIDEO' || p.isReel ? '▶' : (p.mediaType === 'CAROUSEL_ALBUM' ? '▣' : '◉')}</span>
      </div>
    </a>
  `).join('');
}

loadInstagramFeed();

// ============================================
// LANGUAGE SWITCHER — Google Translate
// ============================================
document.querySelectorAll('.lang-switcher a[data-lang]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const lang = link.dataset.lang;
    const currentUrl = window.location.href.split('#')[0];
    // Google Translate URL: traduce in nuova tab la pagina corrente
    const translateUrl = `https://translate.google.com/translate?sl=it&tl=${lang}&u=${encodeURIComponent(currentUrl)}`;
    window.open(translateUrl, '_blank', 'noopener');
  });
});

// ============================================
// NEWSLETTER FORM (sezione prima del footer)
// ============================================
const newsletterForm = document.getElementById('newsletter-form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = newsletterForm.querySelector('.newsletter-feedback');
    const submitBtn = newsletterForm.querySelector('button[type="submit"]');
    const email = newsletterForm.email.value;

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Invio...';

    const action = newsletterForm.getAttribute('action');
    const isPlaceholder = !action || action.includes('TODO');

    const showFeedback = (msg, isError = false) => {
      feedback.textContent = msg;
      feedback.hidden = false;
      feedback.classList.toggle('is-error', isError);
    };

    try {
      if (isPlaceholder) {
        // Fallback: apre client mail finché provider non è connesso
        window.location.href = `mailto:neutralia.info@gmail.com?subject=Iscrizione%20newsletter&body=Vorrei%20iscrivermi%20alla%20newsletter%20di%20Neutralia.%0A%0AMia%20email:%20${encodeURIComponent(email)}`;
        showFeedback('Apertura del client di posta… (Brevo non ancora collegato)');
      } else {
        const formData = new FormData(newsletterForm);
        // Brevo (sibforms.com) non espone CORS: usiamo no-cors.
        // Non possiamo leggere la response, ma il submit funziona.
        await fetch(action, {
          method: 'POST',
          mode: 'no-cors',
          body: formData
        });
        showFeedback('Iscritto! Controlla la tua mail.');
        newsletterForm.reset();
      }
    } catch (err) {
      console.error('Newsletter submit error:', err);
      showFeedback('Qualcosa è andato storto. Riprova o scrivici a neutralia.info@gmail.com', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// PDF form handler
const pdfForm = document.getElementById('pdf-form');
if (pdfForm) {
  pdfForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const modal = pdfForm.closest('.modal-overlay');
    const formState = modal.querySelector('.modal-state-form');
    const successState = modal.querySelector('.modal-state-success');
    const errorState = modal.querySelector('.modal-state-error');
    const submitBtn = pdfForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Invio in corso...';

    const action = pdfForm.getAttribute('action');
    const isPlaceholder = !action || action.includes('TODO');

    try {
      if (isPlaceholder) {
        // Demo mode: nessun provider connesso ancora.
        // Apri il client di posta come fallback temporaneo.
        const email = pdfForm.EMAIL.value;
        window.location.href = `mailto:neutralia.info@gmail.com?subject=Richiesta%20PDF%20Neutralia&body=Ciao,%0A%0AVorrei%20ricevere%20il%20PDF%20gratuito%20di%20Neutralia.%0A%0AMia%20email:%20${encodeURIComponent(email)}%0A%0AGrazie!`;
        formState.hidden = true;
        successState.hidden = false;
      } else {
        const formData = new FormData(pdfForm);
        // Brevo non espone CORS: no-cors mode
        await fetch(action, {
          method: 'POST',
          mode: 'no-cors',
          body: formData
        });
        formState.hidden = true;
        successState.hidden = false;
      }
    } catch (err) {
      console.error('PDF form submit error:', err);
      formState.hidden = true;
      errorState.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}
