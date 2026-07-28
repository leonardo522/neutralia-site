// Anno corrente nel footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ============================================
// PRENOTA EVENTO 19 giugno — submit form al Worker → notifica Telegram
// ============================================
(function initPrenotaForm() {
  const form = document.getElementById('prenota-form');
  if (!form) return;
  const successBox = document.getElementById('prenota-success');
  const feedback = form.querySelector('.prenota-feedback');
  const submitBtn = form.querySelector('button[type="submit"]');
  const endpoint = window.PRENOTA_ENDPOINT;

  function showFeedback(msg, isError) {
    feedback.textContent = msg;
    feedback.hidden = false;
    feedback.classList.toggle('is-error', !!isError);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.hidden = true;
    if (!form.reportValidity()) return;

    const payload = {
      nome: form.nome.value.trim(),
      cognome: form.cognome.value.trim(),
      email: form.email.value.trim(),
      partecipanti: parseInt(form.partecipanti.value, 10) || 1,
    };

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Invio in corso…';

    try {
      if (!endpoint || endpoint.includes('TODO')) {
        // Fallback: apre client mail
        const body = `Nome: ${payload.nome}\nCognome: ${payload.cognome}\nEmail: ${payload.email}\nPartecipanti: ${payload.partecipanti}`;
        window.location.href = `mailto:neutralia.info@gmail.com?subject=${encodeURIComponent('Prenotazione evento 19 giugno')}&body=${encodeURIComponent(body)}`;
        showFeedback('Apertura del client di posta…');
      } else {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.hidden = true;
        successBox.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Prenotazione errore:', err);
      showFeedback('Errore nell\'invio. Riprova o scrivici a neutralia.info@gmail.com', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
})();

// ============================================
// BIO OSPITI evento 19 giugno — click → mostra bio sotto i nomi
// ============================================
(function initEventoBio() {
  const list = document.getElementById('evento-ospiti');
  const biosEl = document.getElementById('evento-bios');
  const panel = document.getElementById('evento-bio');
  if (!list || !biosEl || !panel) return;

  let bios = {};
  try { bios = JSON.parse(biosEl.textContent); } catch {}

  const nomeEl = panel.querySelector('.evento-bio-nome');
  const testoEl = panel.querySelector('.evento-bio-testo');
  let active = null;

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.evento-ospite-btn');
    if (!btn) return;
    const id = btn.dataset.bio;
    const bio = bios[id];
    if (!bio) return;

    // Toggle: secondo click sullo stesso = chiude
    if (active === btn) {
      panel.hidden = true;
      btn.classList.remove('is-active');
      active = null;
      return;
    }
    // Disattiva precedente
    list.querySelectorAll('.evento-ospite-btn.is-active').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    nomeEl.textContent = btn.textContent.trim();
    testoEl.textContent = bio;
    panel.hidden = false;
    active = btn;
  });
})();

// ============================================
// COOKIE BANNER — minimale, GDPR-compliant
// Salva la scelta in localStorage; riapribile via link "Gestisci cookie"
// ============================================
(function initCookieBanner() {
  const KEY = 'neutralia_cookie_consent';
  const VALUE_ACCEPTED = 'accepted';
  const VALUE_ESSENTIAL = 'essential-only';

  function getConsent() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  function setConsent(v) {
    try { localStorage.setItem(KEY, v); } catch {}
  }

  function buildBanner() {
    const b = document.createElement('aside');
    b.className = 'cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Informativa sui cookie');
    b.innerHTML = `
      <div class="cookie-banner-inner">
        <p class="cookie-banner-text">
          Neutralia usa solo <strong>cookie tecnici</strong> e servizi terzi essenziali (Brevo, Stripe).
          Nessun tracker, nessuna pubblicità. Continuando dichiari di aver letto la
          <a href="privacy.html">Privacy</a> e la <a href="cookie.html">Cookie Policy</a>.
        </p>
        <div class="cookie-banner-actions">
          <button type="button" class="cookie-btn cookie-btn-secondary" data-cookie="essential">Solo necessari</button>
          <button type="button" class="cookie-btn cookie-btn-primary" data-cookie="accept">Accetta</button>
        </div>
      </div>
    `;
    return b;
  }

  function show() {
    if (document.querySelector('.cookie-banner')) return;
    const banner = buildBanner();
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('is-open'));
    banner.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      setConsent(btn.dataset.cookie === 'accept' ? VALUE_ACCEPTED : VALUE_ESSENTIAL);
      banner.classList.remove('is-open');
      setTimeout(() => banner.remove(), 250);
    });
  }

  // Mostra solo se non c'è una scelta precedente
  if (!getConsent()) {
    // ritardo leggero per non bloccare il primo render
    setTimeout(show, 800);
  }

  // Link "Gestisci cookie" nel footer riapre il banner
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cookie-manage]')) {
      e.preventDefault();
      try { localStorage.removeItem(KEY); } catch {}
      show();
    }
  });
})();

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
// INSTAGRAM FEED — Cloudflare Pages Function /api/instagram-feed
// Proxy Behold con caching CDN 6h + proxy immagini /api/instagram-image
// (cachate 30gg). Niente più scadenze Instagram CDN, niente GitHub Action,
// niente commit periodici. Fallback a JSON locale se l'endpoint non c'è.
// ============================================
async function loadInstagramFeed() {
  const grid = document.getElementById('ig-feed');
  if (!grid) return;

  let posts;
  try {
    // Prima prova: endpoint dinamico su Cloudflare Pages
    let res = await fetch('/api/instagram-feed', { cache: 'no-cache' });
    if (!res.ok) throw new Error('feed function ' + res.status);
    posts = (await res.json()).posts;
  } catch (errFn) {
    // Fallback: JSON locale (utile in dev locale senza Pages Functions)
    try {
      const res = await fetch('assets/data/instagram.json', { cache: 'no-cache' });
      posts = (await res.json()).posts;
    } catch (err) {
      console.error('Instagram feed load failed:', err, errFn);
      return;
    }
  }

  grid.innerHTML = posts.map(p => {
    // Cella speciale "Vedi tutti" (quella senza thumbnail): renderizzata in stile sito
    if (!p.thumbnailUrl) {
      return `
        <a href="${p.permalink}" target="_blank" rel="noopener" class="ig-post ig-post-vedi-tutti" aria-label="Vedi tutti i post su Instagram">
          <div class="ig-vedi-tutti">
            <span class="ig-vedi-tutti-eyebrow">Su Instagram</span>
            <span class="ig-vedi-tutti-text">Vedi tutti<br>i post</span>
            <span class="ig-vedi-tutti-handle">@_neutralia_ ↗</span>
          </div>
        </a>
      `;
    }
    return `
      <a href="${p.permalink}" target="_blank" rel="noopener" class="ig-post" aria-label="${p.captionShort || 'Post Instagram'}">
        <img src="${p.thumbnailUrl}" alt="" loading="lazy">
        <div class="ig-post-overlay">
          <span class="ig-post-icon" aria-hidden="true">${p.mediaType === 'VIDEO' || p.isReel ? '▶' : (p.mediaType === 'CAROUSEL_ALBUM' ? '▣' : '◉')}</span>
        </div>
      </a>
    `;
  }).join('');
}

loadInstagramFeed();

// ============================================
// LANGUAGE SWITCHER
// I link sono diretti alle versioni tradotte (en/, fr/, es/, de/).
// Nessun JS necessario: comportamento <a href> standard.
// ============================================

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

// ============================================
// INTERVENTI — animazione entry destra→sinistra + modal video fullscreen
// ============================================
(function initInterventi() {
  const track = document.querySelector('.interventi-track');
  const modal = document.getElementById('video-modal');
  if (!track || !modal) return;

  const cards = Array.from(track.querySelectorAll('.intervento-card'));
  const modalSlot = modal.querySelector('.video-modal-slot');
  const modalClose = modal.querySelector('.video-modal-close');

  // 1) IntersectionObserver: quando il track entra in viewport, aggiungi .is-in
  //    a ogni card. Lo stagger è dato dal CSS via --i su ogni card.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          cards.forEach((c) => c.classList.add('is-in'));
          io.disconnect();
        }
      });
    }, { threshold: 0.15 });
    io.observe(track);
  } else {
    cards.forEach((c) => c.classList.add('is-in'));
  }

  // 2) Modal: apertura al click sulla card, chiusura con X / Esc / click fuori
  function openModal(card) {
    const videoId = card.dataset.video;
    if (!videoId) return;
    const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    modalSlot.innerHTML = `<iframe src="${src}" title="Intervento" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('video-modal-open');
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('video-modal-open');
    modalSlot.innerHTML = ''; // stop del video
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => openModal(card));
    // accessibilità: il pulsante-hit trasparente supporta anche keyboard
    const hit = card.querySelector('.intervento-hit');
    if (hit) hit.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(card);
    });
  });
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
})();

// ── Galleria maglietta (Negozio) ──────────────────────────────────
// Fade al cambio foto, lente d'ingrandimento al passaggio del mouse,
// lightbox a tutto schermo con frecce al click sulla foto.
(() => {
  const main = document.getElementById('merch-main-img');
  if (!main) return;
  const thumbs = Array.from(document.querySelectorAll('.merch-thumb'));
  const items = thumbs.map((b) => ({ src: b.dataset.full, alt: b.querySelector('img')?.alt || '' }));
  let current = 0;

  // Prima apparizione in fade quando la foto iniziale è pronta
  main.style.opacity = '0';
  const reveal = () => { main.style.opacity = '1'; };
  if (main.complete && main.naturalWidth > 0) requestAnimationFrame(reveal);
  else main.addEventListener('load', reveal, { once: true });

  // Precarica tutte le foto della galleria: i cambi diventano istantanei
  window.addEventListener('load', () => {
    items.forEach((it) => { const im = new Image(); im.src = it.src; });
  });

  let switching = false;
  const showIndex = (i) => {
    if (switching || i === current) return;
    switching = true;
    current = i;
    thumbs.forEach((b) => b.classList.remove('is-active'));
    thumbs[i].classList.add('is-active');
    const next = new Image();
    main.style.opacity = '0';
    next.onload = () => {
      setTimeout(() => {
        main.src = next.src;
        if (items[i].alt) main.alt = 'Maglietta Neutralia — ' + items[i].alt;
        setTimeout(() => { main.style.opacity = '1'; switching = false; }, 30);
      }, 300);
    };
    next.onerror = () => { main.style.opacity = '1'; switching = false; };
    next.src = items[i].src;
  };
  thumbs.forEach((btn, i) => btn.addEventListener('click', () => showIndex(i)));

  // ── Lente d'ingrandimento quadrata (solo mouse/desktop) ──
  const stage = document.getElementById('pdp-stage');
  if (stage && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const LENS = 190, ZOOM = 2.2;
    const lens = document.createElement('div');
    lens.className = 'pdp-lens';
    stage.appendChild(lens);
    stage.addEventListener('mousemove', (e) => {
      if (!main.naturalWidth) return;
      const r = main.getBoundingClientRect();
      // area realmente disegnata dentro object-fit: contain
      const scale = Math.min(r.width / main.naturalWidth, r.height / main.naturalHeight);
      const dw = main.naturalWidth * scale, dh = main.naturalHeight * scale;
      const dx = r.left + (r.width - dw) / 2, dy = r.top + (r.height - dh) / 2;
      const x = e.clientX, y = e.clientY;
      if (x < dx || x > dx + dw || y < dy || y > dy + dh) { lens.style.display = 'none'; return; }
      const sr = stage.getBoundingClientRect();
      const lx = Math.max(0, Math.min(x - sr.left - LENS / 2, sr.width - LENS));
      const ly = Math.max(0, Math.min(y - sr.top - LENS / 2, sr.height - LENS));
      const bgW = dw * ZOOM, bgH = dh * ZOOM;
      const bx = Math.max(-(bgW - LENS), Math.min(0, -((x - dx) * ZOOM - LENS / 2)));
      const by = Math.max(-(bgH - LENS), Math.min(0, -((y - dy) * ZOOM - LENS / 2)));
      lens.style.display = 'block';
      lens.style.left = lx + 'px';
      lens.style.top = ly + 'px';
      lens.style.backgroundImage = `url("${main.src}")`;
      lens.style.backgroundSize = bgW + 'px ' + bgH + 'px';
      lens.style.backgroundPosition = bx + 'px ' + by + 'px';
    });
    stage.addEventListener('mouseleave', () => { lens.style.display = 'none'; });
  }

  // ── Lightbox a tutto schermo con frecce ──
  const CHEV_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M15 4 7 12l8 8"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M9 4l8 8-8 8"/></svg>';
  const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M5 5l14 14M19 5 5 19"/></svg>';

  let lb = null, lbImg = null, lbCount = null, lbIndex = 0;
  const buildLightbox = () => {
    lb = document.createElement('div');
    lb.className = 'pdp-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Galleria foto maglietta');
    lb.innerHTML = `
      <img class="lb-img" alt="">
      <button type="button" class="lb-btn lb-prev" aria-label="Foto precedente">${CHEV_L}</button>
      <button type="button" class="lb-btn lb-next" aria-label="Foto successiva">${CHEV_R}</button>
      <button type="button" class="lb-btn lb-close" aria-label="Chiudi">${CROSS}</button>
      <div class="lb-count"></div>`;
    document.body.appendChild(lb);
    lbImg = lb.querySelector('.lb-img');
    lbCount = lb.querySelector('.lb-count');
    lb.querySelector('.lb-prev').addEventListener('click', () => lbShow(lbIndex - 1));
    lb.querySelector('.lb-next').addEventListener('click', () => lbShow(lbIndex + 1));
    lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  };

  const lbShow = (i) => {
    lbIndex = (i + items.length) % items.length;
    lbImg.style.opacity = '0';
    const pre = new Image();
    pre.onload = () => {
      lbImg.src = pre.src;
      lbImg.alt = items[lbIndex].alt ? 'Maglietta Neutralia — ' + items[lbIndex].alt : 'Maglietta Neutralia';
      setTimeout(() => { lbImg.style.opacity = '1'; }, 20);
    };
    pre.src = items[lbIndex].src;
    lbCount.textContent = (lbIndex + 1) + ' / ' + items.length;
  };

  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
    else if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
  };

  const openLightbox = (i) => {
    if (!lb) buildLightbox();
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    lbShow(i);
  };

  const closeLightbox = () => {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lbIndex !== current) showIndex(lbIndex); // riallinea la galleria all'ultima foto vista
  };

  main.addEventListener('click', () => openLightbox(current));
})();
