/* ============================================
   NEUTRALIA — Osservatorio (Leaflet)
   Mappa nera, confine Italia bianco, marker SVG nativi,
   linee sempre visibili basi→conflitti, aree marine.
   ============================================ */

(function () {
  'use strict';

  const DATA = {
    italia:     'assets/data/italia.geojson',
    regioni:    'assets/data/italia-regioni.geojson',
    aree:       'assets/data/osservatorio-aree-interdette.geojson',
    basi:       'assets/data/osservatorio-basi.json',
    produzione: 'assets/data/osservatorio-produzione.json',
    porti:      'assets/data/osservatorio-porti.json',
    conflitti:  'assets/data/osservatorio-conflitti.json',
    incidenti:  'assets/data/osservatorio-incidenti.json'
  };

  const COLORI = {
    basi:       '#ff2a2a',
    produzione: '#ff8a00',
    porti:      '#efe847',
    conflitti:  '#9a9a9a',
    incidenti:  '#ffffff',
    confine:    '#ffffff',
    aree:       '#ff2a2a'
  };

  // La scheda si apre nel pannello accanto alla mappa (sul telefono sale dal basso).
  const pannello = document.getElementById('osv-pannello');
  const elencoEl = document.getElementById('osv-elenco');
  const schedaEl = document.getElementById('osv-scheda');
  const schedaCorpo = document.getElementById('osv-scheda-corpo');
  let schedaAperta = false;
  let scelto = null;
  let rottePunti = null;
  const modelli = window.OsvModelli ? OsvModelli.crea(document.getElementById('osv-modello')) : null;
  if (!modelli) document.querySelector('.osv-modello').hidden = true;

  function marcaScelto(marker) {
    if (scelto) scelto.classList.remove('is-scelto');
    scelto = marker && marker.getElement() ? marker.getElement().querySelector('.osv-b') : null;
    if (scelto) scelto.classList.add('is-scelto');
  }

  function apriScheda(html, lat, lon, opz) {
    const o = opz || {};
    schedaCorpo.innerHTML = html;
    schedaEl.hidden = false;
    elencoEl.hidden = true;
    schedaAperta = true;
    pannello.scrollTop = 0;
    schedaEl.scrollTop = 0;
    document.body.classList.add('osv-scheda-aperta');
    marcaScelto(o.marker);
    document.querySelector('.osv-modello').hidden = !modelli || !o.modello;
    if (modelli && o.modello) modelli.mostra(o.modello);
    if (!o.fermo && lat != null) mappa.setView([lat, lon], Math.max(mappa.getZoom(), 9), { animate: true });
    schedaEl.querySelector('.osv-chiudi').focus({ preventScroll: true });
  }

  function chiudiScheda() {
    if (!schedaAperta) return;
    schedaEl.hidden = true;
    elencoEl.hidden = false;
    schedaAperta = false;
    document.body.classList.remove('osv-scheda-aperta');
    marcaScelto(null);
    if (modelli) modelli.ferma();
    rottePunti = null;
    layers.linee.clearLayers();
    layers.conflitti.clearLayers();
    document.querySelectorAll('.osv-tempo-riga.is-attiva').forEach((r) => r.classList.remove('is-attiva'));
    inquadraItalia();
  }

  document.querySelector('.osv-chiudi').addEventListener('click', chiudiScheda);
  schedaCorpo.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-rotte]') && rottePunti) mappa.fitBounds(rottePunti, { padding: [30, 30], maxZoom: 7, animate: true });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') chiudiScheda();
  });

  // ---------- INIT MAPPA ----------
  const ITALIA = [[36.4, 6.6], [47.2, 18.6]];
  const mappa = L.map('mappa', {
    center: [42.3, 12.5],
    zoom: 6,
    zoomSnap: 0.25,
    zoomDelta: 1,
    wheelPxPerZoomLevel: 50,
    wheelDebounceTime: 20,
    fadeAnimation: false,
    minZoom: 3,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: false,
    preferCanvas: false,
    maxBounds: [[-5, -25], [62, 85]],
    maxBoundsViscosity: 0.8,
    renderer: L.svg({ padding: 0.5 })
  });

  // Nessuna attribuzione: niente "Leaflet · openpolis · Centro Studi Neutralia" in basso.

  // Esponi la mappa per debug/console
  window.NeutraliaMap = mappa;

  const inquadraItalia = () => mappa.fitBounds(ITALIA, { padding: [8, 8], animate: true });
  mappa.fitBounds(ITALIA, { padding: [8, 8] });
  let vistaIniziale = true;
  mappa.on('dragstart', () => { vistaIniziale = false; });
  mappa.getContainer().addEventListener('wheel', () => { vistaIniziale = false; }, { passive: true });
  new ResizeObserver(() => {
    mappa.invalidateSize({ pan: false });
    if (vistaIniziale && !schedaAperta) mappa.fitBounds(ITALIA, { padding: [8, 8], animate: false });
  }).observe(document.getElementById('mappa'));

  // ---------- LAYER GROUPS ----------
  const layers = {
    linee:      L.layerGroup().addTo(mappa),  // sotto a tutto
    conflitti:  L.layerGroup().addTo(mappa),
    aree:       L.layerGroup().addTo(mappa),
    basi:       L.layerGroup().addTo(mappa),
    produzione: L.layerGroup().addTo(mappa),
    porti:      L.layerGroup().addTo(mappa),
    incidenti:  L.layerGroup().addTo(mappa)
  };

  // ---------- HELPERS ----------
  // Icone SVG tematiche per produzione, porti, incidenti
  const ICONE = {
    porto: {
      svg: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.5"/><line x1="12" y1="7" x2="12" y2="22"/><line x1="8" y1="12" x2="16" y2="12"/><path d="M3 13c0 5 4 9 9 9s9-4 9-9"/></svg>',
      color: '#efe847',
      className: 'osv-icon-porto'
    },
    produzione: {
      // Proiettile 9mm realistico: ogiva curva + cintura + bossolo con striature verticali + fondello + percussore
      svg: '<svg viewBox="0 0 24 24"><path d="M 7 8 Q 7 2 12 1 Q 17 2 17 8 Z" fill="currentColor"/><rect x="6.7" y="8" width="10.6" height="0.9" fill="currentColor"/><rect x="7" y="8.9" width="10" height="11.2" fill="currentColor" opacity="0.82"/><rect x="8.4" y="8.9" width="0.45" height="11.2" fill="#000" opacity="0.22"/><rect x="10.5" y="8.9" width="0.45" height="11.2" fill="#000" opacity="0.22"/><rect x="13" y="8.9" width="0.45" height="11.2" fill="#000" opacity="0.22"/><rect x="15" y="8.9" width="0.45" height="11.2" fill="#000" opacity="0.22"/><rect x="6.4" y="20.1" width="11.2" height="1.2" fill="currentColor"/><rect x="6.4" y="21.3" width="11.2" height="1.8" rx="0.3" fill="currentColor" opacity="0.55"/></svg>',
      color: '#ff8a00',
      className: 'osv-icon-produzione'
    },
    incidente: {
      svg: '<svg viewBox="0 0 24 24"><path d="M12 2 L22 21 L2 21 Z" fill="currentColor" stroke="#000" stroke-width="0.8" stroke-linejoin="round"/><rect x="11" y="9" width="2" height="6" fill="#000"/><rect x="11" y="17" width="2" height="2" fill="#000"/></svg>',
      color: '#ffffff',
      className: 'osv-icon-incidente'
    },
    nucleare: {
      // Trifoglio radioattivo standard: 3 settori da 60° gialli su sfondo nero, centro giallo
      svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11.5" fill="#ffe600" stroke="#000" stroke-width="0.7"/><circle cx="12" cy="12" r="2.4" fill="#000"/><path d="M 12 12 L 22.4 12 A 10.4 10.4 0 0 0 17.2 3 Z" fill="#000"/><path d="M 12 12 L 6.8 3 A 10.4 10.4 0 0 0 1.6 12 Z" fill="#000"/><path d="M 12 12 L 17.2 21 A 10.4 10.4 0 0 1 6.8 21 Z" fill="#000"/></svg>',
      color: '#ffe600',
      className: 'osv-icon-nucleare'
    },
    nucleare_scalo: {
      // Stesso trifoglio ma bianco (porti/basi autorizzati per scali sub nucleari USA/UK/FR)
      svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11.5" fill="#ffffff" stroke="#000" stroke-width="0.7"/><circle cx="12" cy="12" r="2.4" fill="#000"/><path d="M 12 12 L 22.4 12 A 10.4 10.4 0 0 0 17.2 3 Z" fill="#000"/><path d="M 12 12 L 6.8 3 A 10.4 10.4 0 0 0 1.6 12 Z" fill="#000"/><path d="M 12 12 L 17.2 21 A 10.4 10.4 0 0 1 6.8 21 Z" fill="#000"/></svg>',
      color: '#ffffff',
      className: 'osv-icon-nucleare-scalo'
    }
  };

  // Pittogrammi delle icone: stessa griglia 24×24, tondo colorato e segno scuro.
  const SEGNI = {
    aerea: '<path d="M12 1.8l1.5 6.9 7.5 4.3v2.1l-7.5-2.3-.6 5.1 2.5 1.9v1.5L12 20.2l-3.4 1.1v-1.5l2.5-1.9-.6-5.1L3 15.1V13l7.5-4.3z"/>',
    navale: '<path d="M2.5 14.5h19l-2.6 5.3H5.1z"/><path d="M6 13.6l1-3.8h3.6V6.7h3v3.1H17l1 3.8z"/><rect x="11.5" y="3" width="1.2" height="3.7"/>',
    radar: '<path d="M3.6 6.2a12 12 0 0 0 14.6 14.6z"/><path d="M12 12l5.2-5.2" stroke="currentColor" stroke-width="1.9" fill="none"/><circle cx="18" cy="6" r="1.9"/>',
    poligono: '<circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.9"/>',
    logistica: '<path d="M12 2.5l8.6 4.6v9.8L12 21.5l-8.6-4.6V7.1z"/><path d="M3.8 7.2L12 11.7l8.2-4.5M12 11.7v9.6" stroke="var(--c)" stroke-width="1.5" fill="none"/>',
    comando: '<path d="M3 21V9.4l9-5.2 9 5.2V21h-6v-6H9v6z"/>',
    esercito: '<path d="M12 2l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.1l-6.2 3.6 1.6-6.9L2.1 9.1l7-.7z"/>',
    fabbrica: '<path d="M2.5 21V11l6 3.6V11l6 3.6V3.5h7V21z"/>',
    porto: '<circle cx="12" cy="4.4" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.6V21M7.8 11h8.4M3.4 13.4c.4 4.6 4 7.6 8.6 7.6s8.2-3 8.6-7.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    incidente: '<path d="M12 2.5l10 18.2H2z"/><rect x="11" y="9.3" width="2" height="6" fill="var(--c)"/><rect x="11" y="16.6" width="2" height="2" fill="var(--c)"/>'
  };

  const icone = [];

  function makeBadge(lat, lon, tipo, colore, nucleare) {
    const bollo = nucleare === 'scalo' ? `<span class="osv-bollo">${ICONE.nucleare_scalo.svg}</span>` : '';
    const segno = nucleare === 'bomba' ? ICONE.nucleare.svg : `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SEGNI[tipo]}</svg>`;
    const icon = L.divIcon({
      className: 'osv-marker',
      html: `<span class="osv-b${nucleare === 'bomba' ? ' osv-b-nucleare' : ''}" style="--c:${colore}">${segno}${bollo}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    const m = L.marker([lat, lon], { icon, bubblingMouseEvents: false, riseOnHover: true });
    icone.push(m);
    return m;
  }

  /* Le icone troppo vicine si scostano solo nella vista d'insieme. Lo scostamento
     si dimezza a ogni livello di zoom: da vicino ogni icona sta esattamente sul posto. */
  let zoomBase = null;
  function applicaScosti(zoom) {
    const k = Math.pow(2, zoomBase - zoom);
    icone.forEach((m) => {
      const el = m.getElement();
      if (el && m.scosto) el.querySelector('.osv-b').style.translate = `${(m.scosto[0] * k).toFixed(1)}px ${(m.scosto[1] * k).toFixed(1)}px`;
    });
  }

  function separaIcone() {
    const lato = 29;
    zoomBase = mappa.getZoom();
    const voci = icone
      .filter((m) => m._map && m.getElement())
      .map((m) => {
        const p = mappa.latLngToLayerPoint(m.getLatLng());
        return { m, x: p.x, y: p.y, x0: p.x, y0: p.y };
      });
    for (let giro = 0; giro < 12; giro++) {
      for (let i = 0; i < voci.length; i++) {
        for (let j = i + 1; j < voci.length; j++) {
          const a = voci[i], b = voci[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d >= lato) continue;
          if (d < 0.01) { dx = 1; dy = (i % 2) - 0.5; d = Math.hypot(dx, dy); }
          const k = (lato - d) / 2 / d;
          a.x -= dx * k; a.y -= dy * k;
          b.x += dx * k; b.y += dy * k;
        }
      }
    }
    voci.forEach((v) => { v.m.scosto = [v.x - v.x0, v.y - v.y0]; });
    applicaScosti(zoomBase);
    mappa.on('zoomanim', (e) => applicaScosti(e.zoom));
    mappa.on('zoomend', () => applicaScosti(mappa.getZoom()));
  }

  function tipoBase(b) {
    const t = b.tipo;
    if (/radar|radio|satellit|muos/i.test(t)) return 'radar';
    if (/poligono/i.test(t)) return 'poligono';
    if (/aerea|aeroport/i.test(t)) return 'aerea';
    if (/navale|navy|sottomarin|marina/i.test(t)) return 'navale';
    if (/logistica/i.test(t)) return 'logistica';
    if (/army/i.test(t)) return 'esercito';
    return 'comando';
  }

  function disegnaLegenda() {
    const voci = [
      ['aerea', COLORI.basi, 'Base aerea'], ['navale', COLORI.basi, 'Base navale'], ['esercito', COLORI.basi, 'Base dell\'esercito'],
      ['radar', COLORI.basi, 'Stazione radar o radio'], ['poligono', COLORI.basi, 'Poligono'], ['logistica', COLORI.basi, 'Base logistica'],
      ['comando', COLORI.basi, 'Comando, centro o istituto'], ['fabbrica', COLORI.produzione, 'Produzione di armi'],
      ['porto', COLORI.porti, 'Porto'], ['incidente', COLORI.incidenti, 'Incidente o caso documentato']
    ];
    document.getElementById('osv-legenda-tipi').innerHTML = voci.map(([t, c, nome]) => `<li><span class="osv-b osv-b-fermo" style="--c:${c}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SEGNI[t]}</svg></span>${nome}</li>`).join('');
  }
  disegnaLegenda();

  function listToHTML(arr) {
    if (!arr || !arr.length) return '<em>—</em>';
    return '<ul>' + arr.map(x => `<li>${escapeHTML(x)}</li>`).join('') + '</ul>';
  }

  function fontiHTML(fonti) {
    if (!fonti || !fonti.length) return '';
    const voce = (f) => {
      if (f && f.url) return `<li><a href="${escapeHTML(f.url)}" target="_blank" rel="noopener">${escapeHTML(f.titolo || f.url)}</a></li>`;
      const testo = String(f);
      const m = testo.match(/https?:\/\/\S+/);
      return m ? `<li><a href="${escapeHTML(m[0])}" target="_blank" rel="noopener">${escapeHTML(testo)}</a></li>` : `<li>${escapeHTML(testo)}</li>`;
    };
    return `<details class="popup-fonti"><summary>Fonti (${fonti.length})</summary><ul>${fonti.map(voce).join('')}</ul></details>`;
  }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmtNum(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('it-IT').format(n);
  }

  // ---------- FETCH TUTTI I DATI ----------
  Promise.all([
    fetch(DATA.italia).then(r => r.json()),
    fetch(DATA.regioni).then(r => r.json()),
    fetch(DATA.aree).then(r => r.json()),
    fetch(DATA.basi).then(r => r.json()),
    fetch(DATA.produzione).then(r => r.json()),
    fetch(DATA.porti).then(r => r.json()),
    fetch(DATA.conflitti).then(r => r.json()),
    fetch(DATA.incidenti).then(r => r.json())
  ]).then(([italia, regioni, aree, basi, produzione, porti, conflitti, incidenti]) => {

    // RILIEVO, REGIONI, CONFINE
    L.tileLayer('assets/img/osservatorio/tessere/{z}/{x}/{y}.jpg', {
      minZoom: 3, maxZoom: 10, minNativeZoom: 5, maxNativeZoom: 8,
      bounds: [[33.5, 1], [49.5, 24]], updateWhenZooming: false, keepBuffer: 4
    }).addTo(mappa);
    L.geoJSON(regioni, { style: { color: '#ffffff', weight: 0.7, opacity: 0.22 }, interactive: false }).addTo(mappa);
    L.geoJSON(italia, {
      style: { color: COLORI.confine, weight: 1.3, opacity: 0.85, fill: false },
      interactive: false
    }).addTo(mappa);

    // AREE MARINE INTERDETTE
    L.geoJSON(aree, {
      style: {
        color: COLORI.aree,
        weight: 1,
        opacity: 0.85,
        dashArray: '4 3',
        fillColor: COLORI.aree,
        fillOpacity: 0.15
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const html = `
          <div class="popup popup-area">
            <p class="popup-eyebrow popup-eyebrow-base">Mare interdetto</p>
            <h3>${escapeHTML(p.nome)}</h3>
            <p>${escapeHTML(p.descrizione)}</p>
            ${p.estensione_kmq ? `<p class="popup-stat"><strong>${fmtNum(p.estensione_kmq)} km²</strong> di mare interdetto alla pesca durante le esercitazioni.</p>` : ''}
          </div>
        `;
        layer.on('click', (ev) => apriScheda(html, ev.latlng.lat, ev.latlng.lng, { modello: 'mare' }));
      }
    }).addTo(layers.aree);

    const voci = [];

    // Indice conflitti per ID
    const conflittiPerId = {};
    conflitti.items.forEach(c => { conflittiPerId[c.id] = c; });

    // BASI
    basi.items.forEach(b => {
      const tipo = tipoBase(b);
      const dot = makeBadge(b.lat, b.lon, tipo, COLORI.basi, b.nucleare ? 'bomba' : b.scali_nucleari ? 'scalo' : null);
      const apri = () => {
        disegnaLineeEConflitti(b, conflittiPerId);
        apriScheda(popupBase(b, conflittiPerId), b.lat, b.lon, { marker: dot, modello: b.nucleare ? 'aereaNucleare' : tipo === 'radar' && b.raggi_rischio_km ? 'muos' : tipo });
      };
      dot.on('click', apri);
      voci.push({ nome: b.nome, dove: `${b.comune} · ${b.regione}`, regione: b.regione, tipo: 'basi', etichetta: 'Basi', apri });
      dot.addTo(layers.basi);
    });

    // PRODUZIONE — icona proiettile arancione
    produzione.items.forEach(p => {
      const marker = makeBadge(p.lat, p.lon, 'fabbrica', COLORI.produzione);
      const apri = () => apriScheda(popupProduzione(p), p.lat, p.lon, { marker, modello: /navi/i.test(p.tipo) ? 'cantiere' : /holding/i.test(p.tipo) ? 'comando' : 'fabbrica' });
      marker.on('click', apri);
      voci.push({ nome: p.nome, dove: `${p.comune} · ${p.regione}`, regione: p.regione, tipo: 'produzione', etichetta: 'Produzione', apri });
      marker.addTo(layers.produzione);
    });

    // PORTI — icona ancora gialla, + ☢ bianca se autorizzato scali nucleari
    porti.items.forEach(p => {
      const marker = makeBadge(p.lat, p.lon, 'porto', COLORI.porti, p.scali_nucleari ? 'scalo' : null);
      const apri = () => apriScheda(popupPorto(p), p.lat, p.lon, { marker, modello: 'porto' });
      marker.on('click', apri);
      voci.push({ nome: p.nome, dove: p.regione, regione: p.regione, tipo: 'porti', etichetta: 'Porti', apri });
      marker.addTo(layers.porti);
    });


    // INCIDENTI — triangolo warning bianco
    incidenti.items.forEach(inc => {
      const marker = makeBadge(inc.lat, inc.lon, 'incidente', COLORI.incidenti);
      const apri = () => apriScheda(popupIncidente(inc), inc.lat, inc.lon, { marker, modello: { 'ustica-1980': 'aereo', 'cermis-1998': 'funivia' }[inc.id] || 'esercito' });
      marker.on('click', apri);
      voci.push({ nome: inc.nome, dove: `${inc.comune} · ${inc.regione}`, regione: inc.regione, tipo: 'incidenti', etichetta: 'Incidenti', apri });
      marker.addTo(layers.incidenti);
    });

    // FILTRI
    document.querySelectorAll('[data-filter]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.filter;
        if (input.checked) {
          mappa.addLayer(layers[key]);
        } else {
          mappa.removeLayer(layers[key]);
        }
      });
    });

    preparaElenco(voci);
    preparaTempo(conflitti.items, basi.items, conflittiPerId);

    // Quante voci ha ogni filtro
    document.querySelectorAll('[data-conta]').forEach((el) => {
      el.textContent = el.dataset.conta === 'aree' ? aree.features.length : voci.filter((v) => v.tipo === el.dataset.conta).length;
    });

    // Loading off
    const loading = document.getElementById('mappa-loading');
    if (loading) loading.remove();

    separaIcone();

  }).catch(err => {
    console.error('Errore caricamento dati osservatorio:', err);
    const loading = document.getElementById('mappa-loading');
    if (loading) {
      loading.innerHTML = '<p style="color:#ff2a2a;">Errore nel caricamento della mappa.<br>Ricarica la pagina.</p>';
    }
  });

  // ---------- ELENCO E RICERCA ----------
  function preparaElenco(voci) {
    const campo = document.getElementById('osv-cerca');
    const regione = document.getElementById('osv-regione');
    const lista = document.getElementById('osv-lista');
    const quanti = document.getElementById('osv-quanti');
    [...new Set(voci.map((v) => v.regione))].sort((a, b) => a.localeCompare(b, 'it')).forEach((r) => {
      const o = document.createElement('option');
      o.value = r;
      o.textContent = r;
      regione.appendChild(o);
    });
    const piega = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    function mostra() {
      const q = piega(campo.value.trim());
      const trovate = voci
        .filter((v) => (!regione.value || v.regione === regione.value) && (!q || piega(`${v.nome} ${v.dove}`).includes(q)))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      quanti.textContent = trovate.length === 1 ? '1 punto' : `${trovate.length} punti`;
      lista.innerHTML = '';
      trovate.forEach((v) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `osv-voce osv-voce-${v.tipo}`;
        b.innerHTML = `<span class="osv-voce-tipo">${escapeHTML(v.etichetta)}</span><strong>${escapeHTML(v.nome)}</strong><small>${escapeHTML(v.dove)}</small>`;
        b.addEventListener('click', v.apri);
        li.appendChild(b);
        lista.appendChild(li);
      });
    }
    campo.addEventListener('input', mostra);
    regione.addEventListener('change', mostra);
    mostra();
  }

  // ---------- CONFLITTI NEL TEMPO ----------
  function preparaTempo(conflitti, basi, conflittiPerId) {
    const box = document.getElementById('osv-tempo');
    const oggi = new Date().getFullYear();
    const fine = (c) => (c.anno_fine ? Number(c.anno_fine) : oggi);
    const ordinati = conflitti.slice().sort((a, b) => Number(a.anno_inizio) - Number(b.anno_inizio));
    const da = Math.min(...ordinati.map((c) => Number(c.anno_inizio))) - 1;
    const a = oggi + 1;
    const pos = (anno) => (anno - da) / (a - da) * 100;
    ordinati.forEach((c) => {
      const riga = document.createElement('button');
      riga.type = 'button';
      riga.className = 'osv-tempo-riga';
      const periodo = c.anno_fine === c.anno_inizio ? c.anno_inizio : `${c.anno_inizio}–${c.anno_fine || 'oggi'}`;
      riga.innerHTML = `<span class="osv-tempo-nome">${escapeHTML(c.nome)}</span><span class="osv-tempo-anni">${escapeHTML(periodo)}</span><span class="osv-tempo-pista"><span class="osv-tempo-barra" style="left:${pos(Number(c.anno_inizio))}%;width:${Math.max(pos(fine(c) + 1) - pos(Number(c.anno_inizio)), 1)}%"></span></span>`;
      riga.addEventListener('click', () => {
        document.querySelectorAll('.osv-tempo-riga.is-attiva').forEach((r) => r.classList.remove('is-attiva'));
        const coinvolte = basi.filter((b) => (b.conflitti || []).includes(c.id));
        apriScheda(popupConflitto(c, coinvolte), c.lat, c.lon, { fermo: true });
        riga.classList.add('is-attiva');
        disegnaRotte(c, coinvolte);
        document.getElementById('mappa').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      box.appendChild(riga);
    });
  }

  function disegnaRotte(c, coinvolte) {
    layers.linee.clearLayers();
    layers.conflitti.clearLayers();
    const punti = [[c.lat, c.lon], [42, 12.5]];
    coinvolte.forEach((b) => {
      L.polyline([[b.lat, b.lon], [c.lat, c.lon]], { color: COLORI.basi, weight: 1.4, opacity: 0.7, dashArray: '6 5', className: 'osv-line', interactive: false }).addTo(layers.linee);
      punti.push([b.lat, b.lon]);
    });
    L.circleMarker([c.lat, c.lon], { radius: 8, color: '#000', weight: 1.5, fillColor: COLORI.conflitti, fillOpacity: 1, interactive: false }).addTo(layers.conflitti);
    mappa.fitBounds(punti, { padding: [30, 30], maxZoom: 7, animate: true });
  }

  // ---------- LINEE BASE → CONFLITTI (al click) ----------
  function disegnaLineeEConflitti(base, conflittiPerId) {
    layers.linee.clearLayers();
    layers.conflitti.clearLayers();
    rottePunti = null;
    if (!base.conflitti || !base.conflitti.length) return;
    const punti = [[base.lat, base.lon]];

    base.conflitti.forEach(cid => {
      const c = conflittiPerId[cid];
      if (!c) return;

      // Pallino grigio sul conflitto
      const dotConf = L.circleMarker([c.lat, c.lon], {
        radius: 8,
        color: '#000',
        weight: 1.5,
        fillColor: COLORI.conflitti,
        fillOpacity: 1,
        className: 'osv-dot osv-dot-conflitto'
      });
      dotConf.on('click', () => apriScheda(popupConflitto(c), c.lat, c.lon, { fermo: true }));
      dotConf.addTo(layers.conflitti);

      // Linea tratteggiata base → conflitto
      const linea = L.polyline([[base.lat, base.lon], [c.lat, c.lon]], {
        color: COLORI.basi,
        weight: 1.4,
        opacity: 0.7,
        dashArray: '6 5',
        className: 'osv-line',
        interactive: false
      });
      linea.addTo(layers.linee);
      punti.push([c.lat, c.lon]);
    });
    rottePunti = punti;
  }

  // ---------- POPUP TEMPLATES ----------
  function popupBase(b, conflittiPerId) {
    const conflittiHTML = (b.conflitti && b.conflitti.length)
      ? '<ul class="popup-conflitti">' + b.conflitti.map(cid => {
          const c = conflittiPerId[cid];
          if (!c) return '';
          return `<li><span class="conf-anno">${c.anno_inizio}${c.anno_fine && c.anno_fine !== c.anno_inizio ? '–' + c.anno_fine : c.anno_fine === null ? '–oggi' : ''}</span> <strong>${escapeHTML(c.nome)}</strong></li>`;
        }).join('') + '</ul>'
      : '';

    return `
      <div class="popup popup-base">
        <p class="popup-eyebrow popup-eyebrow-base">Base militare</p>
        <h3>${escapeHTML(b.nome)}</h3>
        <p class="popup-loc">${escapeHTML(b.comune)} · ${escapeHTML(b.regione)}</p>

        <p class="popup-tipo">${escapeHTML(b.tipo)}</p>
        <p class="popup-gestione"><strong>Gestione:</strong> ${escapeHTML(b.gestione)}</p>
        <p class="popup-funzione">${escapeHTML(b.funzione)}</p>

        ${b.estensione_ha ? `<p class="popup-stat"><strong>${fmtNum(b.estensione_ha)} ha</strong> di territorio occupato</p>` : ''}
        ${b.mare_interdetto_kmq ? `<p class="popup-stat"><strong>${fmtNum(b.mare_interdetto_kmq)} km²</strong> di mare interdetto durante le esercitazioni</p>` : ''}

        ${b.armamento && b.armamento.length ? `<div class="popup-section"><h4>Armamento / capacità</h4>${listToHTML(b.armamento)}</div>` : ''}
        ${b.fatti_storici && b.fatti_storici.length ? `<div class="popup-section"><h4>Fatti storici</h4>${listToHTML(b.fatti_storici)}</div>` : ''}
        ${b.problemi_ambientali && b.problemi_ambientali.length ? `<div class="popup-section popup-warning"><h4>Problemi ambientali</h4>${listToHTML(b.problemi_ambientali)}</div>` : ''}
        ${b.problemi_sanitari && b.problemi_sanitari.length ? `<div class="popup-section popup-warning"><h4>Problemi sanitari</h4>${listToHTML(b.problemi_sanitari)}</div>` : ''}

        ${conflittiHTML ? `<div class="popup-section"><h4>Conflitti collegati</h4>${conflittiHTML}<button type="button" class="osv-rotte" data-rotte>Mostra le rotte sulla mappa</button></div>` : ''}

        ${fontiHTML(b.fonti)}
      </div>
    `;
  }

  function popupProduzione(p) {
    return `
      <div class="popup popup-produzione">
        <p class="popup-eyebrow popup-eyebrow-produzione">Produzione armi</p>
        <h3>${escapeHTML(p.nome)}</h3>
        <p class="popup-loc">${escapeHTML(p.comune)} · ${escapeHTML(p.regione)}</p>

        <p class="popup-tipo">${escapeHTML(p.tipo)}</p>
        <p class="popup-gestione"><strong>Azienda:</strong> ${escapeHTML(p.azienda)}</p>

        ${p.produzione && p.produzione.length ? `<div class="popup-section"><h4>Cosa producono</h4>${listToHTML(p.produzione)}</div>` : ''}
        ${p.destinazioni_documentate && p.destinazioni_documentate.length ? `<div class="popup-section"><h4>Destinazioni documentate</h4>${listToHTML(p.destinazioni_documentate)}</div>` : ''}
        ${p.casi_documentati && p.casi_documentati.length ? `<div class="popup-section popup-warning"><h4>Casi documentati</h4>${listToHTML(p.casi_documentati)}</div>` : ''}
        ${p.occupazione ? `<p class="popup-stat">${escapeHTML(p.occupazione)}</p>` : ''}

        ${fontiHTML(p.fonti)}
      </div>
    `;
  }

  function popupPorto(p) {
    return `
      <div class="popup popup-porto">
        <p class="popup-eyebrow popup-eyebrow-porto">Porto</p>
        <h3>${escapeHTML(p.nome)}</h3>
        <p class="popup-loc">${escapeHTML(p.regione)}</p>

        <p class="popup-tipo">${escapeHTML(p.tipo)}</p>
        <p class="popup-gestione"><strong>Gestione:</strong> ${escapeHTML(p.gestione)}</p>
        <p class="popup-funzione">${escapeHTML(p.ruolo_militare)}</p>

        ${p.flussi_stimati ? `<div class="popup-section"><h4>Flussi militari</h4><p>${escapeHTML(p.flussi_stimati)}</p></div>` : ''}
        ${p.questione_sovranita ? `<div class="popup-section popup-warning"><h4>Questione sovranità</h4><p>${escapeHTML(p.questione_sovranita)}</p></div>` : ''}
        ${p.casi_documentati && p.casi_documentati.length ? `<div class="popup-section"><h4>Casi documentati</h4>${listToHTML(p.casi_documentati)}</div>` : ''}

        ${fontiHTML(p.fonti)}
      </div>
    `;
  }

  function popupConflitto(c, coinvolte) {
    const basiHTML = coinvolte && coinvolte.length
      ? `<div class="popup-section"><h4>Basi collegate</h4>${listToHTML(coinvolte.map((b) => b.nome))}</div>`
      : '';
    return `
      <div class="popup popup-conflitto">
        <p class="popup-eyebrow popup-eyebrow-conflitto">Conflitto</p>
        <h3>${escapeHTML(c.nome)}</h3>
        <p class="popup-loc">${escapeHTML(c.durata)}</p>
        <div class="popup-section popup-warning">
          <h4>Vittime stimate</h4>
          <p>${escapeHTML(c.vittime_stimate)}</p>
        </div>
        <div class="popup-section">
          <h4>Ruolo dell'Italia</h4>
          <p>${escapeHTML(c.ruolo_italia)}</p>
        </div>
        ${basiHTML}
        ${fontiHTML(c.fonti)}
      </div>
    `;
  }

  function popupIncidente(i) {
    return `
      <div class="popup popup-incidente">
        <p class="popup-eyebrow popup-eyebrow-incidente">Incidente / caso documentato</p>
        <h3>${escapeHTML(i.nome)}</h3>
        <p class="popup-loc">${escapeHTML(i.comune)} · ${escapeHTML(i.regione)} · ${escapeHTML(i.data)}</p>

        ${i.vittime ? `<p class="popup-stat popup-stat-rosso"><strong>${fmtNum(i.vittime)}</strong> vittime</p>` : ''}

        <p class="popup-funzione">${escapeHTML(i.sintesi)}</p>

        ${i.esito_giudiziario && i.esito_giudiziario.length ? `<div class="popup-section popup-warning"><h4>Esito giudiziario</h4>${listToHTML(i.esito_giudiziario)}</div>` : ''}
        ${i.risarcimenti ? `<div class="popup-section"><h4>Risarcimenti</h4><p>${escapeHTML(i.risarcimenti)}</p></div>` : ''}
        ${i.rilevanza ? `<div class="popup-section"><h4>Perché è significativo</h4><p>${escapeHTML(i.rilevanza)}</p></div>` : ''}

        ${fontiHTML(i.fonti)}
      </div>
    `;
  }

})();
