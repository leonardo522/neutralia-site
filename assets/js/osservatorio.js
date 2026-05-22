/* ============================================
   NEUTRALIA — Osservatorio (Leaflet)
   Mappa nera, confine Italia bianco, marker SVG nativi,
   linee sempre visibili basi→conflitti, aree marine.
   ============================================ */

(function () {
  'use strict';

  const DATA = {
    italia:     'assets/data/italia.geojson',
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

  // Popup come modale centrato a schermo (gestito dal CSS).
  // Disattivo autoPan perché non ha senso panare la mappa: il popup è fisso.
  const POPUP_OPTS = {
    maxWidth: 1000,            // largo: il CSS lo limiterà a min(540px, 92vw)
    minWidth: 0,
    autoPan: false,
    keepInView: false,
    closeOnEscapeKey: true,
    className: 'osv-popup'
  };

  // ---------- INIT MAPPA ----------
  const mappa = L.map('mappa', {
    center: [42.3, 12.5],
    zoom: 6,
    minZoom: 5,
    maxZoom: 11,
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: false,
    preferCanvas: false,
    maxBounds: [[33.5, 2.0], [50.0, 25.0]],
    maxBoundsViscosity: 0.8,
    renderer: L.svg({ padding: 0.5 })
  });

  // Nessuna attribuzione: niente "Leaflet · openpolis · Centro Studi Neutralia" in basso.

  // Esponi la mappa per debug/console
  window.NeutraliaMap = mappa;

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
  function makePulseMarker(lat, lon, color, className) {
    // Cerchio "alone" che pulsa via CSS animation su r/opacity
    return L.circleMarker([lat, lon], {
      radius: 7,
      color: color,
      weight: 0,
      fillColor: color,
      fillOpacity: 0.55,
      className: 'osv-pulse ' + (className || ''),
      interactive: false
    });
  }

  function makeDotMarker(lat, lon, color, className) {
    return L.circleMarker([lat, lon], {
      radius: 6,
      color: '#000',
      weight: 1.5,
      fillColor: color,
      fillOpacity: 1,
      className: 'osv-dot ' + (className || ''),
      bubblingMouseEvents: false
    });
  }

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

  function makeNukeOverlay(lat, lon, kind) {
    const ic = ICONE[kind];
    const size = kind === 'nucleare_scalo' ? 14 : 22;
    const icon = L.divIcon({
      className: 'osv-nuke-marker',
      html: `<span class="osv-nuke-svg osv-nuke-${kind}">${ic.svg}</span>`,
      iconSize: [size, size],
      iconAnchor: kind === 'nucleare_scalo' ? [-4, 18] : [-3, 25]
    });
    return L.marker([lat, lon], { icon, interactive: false, keyboard: false, zIndexOffset: 1000 });
  }

  function makeIconMarker(lat, lon, kind, className) {
    const ic = ICONE[kind];
    const icon = L.divIcon({
      className: 'osv-icon-marker ' + (className || ''),
      html: `<span class="osv-icon-svg" style="color:${ic.color}">${ic.svg}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
    return L.marker([lat, lon], { icon, bubblingMouseEvents: false });
  }

  function listToHTML(arr) {
    if (!arr || !arr.length) return '<em>—</em>';
    return '<ul>' + arr.map(x => `<li>${escapeHTML(x)}</li>`).join('') + '</ul>';
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
    fetch(DATA.aree).then(r => r.json()),
    fetch(DATA.basi).then(r => r.json()),
    fetch(DATA.produzione).then(r => r.json()),
    fetch(DATA.porti).then(r => r.json()),
    fetch(DATA.conflitti).then(r => r.json()),
    fetch(DATA.incidenti).then(r => r.json())
  ]).then(([italia, aree, basi, produzione, porti, conflitti, incidenti]) => {

    // CONFINE ITALIA
    L.geoJSON(italia, {
      style: {
        color: COLORI.confine,
        weight: 1.2,
        opacity: 0.95,
        fillColor: '#111',
        fillOpacity: 0.55
      },
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
            <p class="popup-stat"><strong>${fmtNum(p.estensione_kmq)} km²</strong> di mare interdetto alla pesca durante le esercitazioni.</p>
          </div>
        `;
        layer.bindPopup(html, POPUP_OPTS);
      }
    }).addTo(layers.aree);

    // Indice conflitti per ID
    const conflittiPerId = {};
    conflitti.items.forEach(c => { conflittiPerId[c.id] = c; });

    // BASI
    basi.items.forEach(b => {
      const pulse = makePulseMarker(b.lat, b.lon, COLORI.basi);
      const dot = makeDotMarker(b.lat, b.lon, COLORI.basi, 'osv-dot-base');
      dot.bindPopup(popupBase(b, conflittiPerId), POPUP_OPTS);
      dot.on('click', () => disegnaLineeEConflitti(b, conflittiPerId));
      pulse.addTo(layers.basi);
      dot.addTo(layers.basi);

      // Icona ☢ NUCLEARE per basi con testate B61 (Aviano, Ghedi)
      if (b.nucleare) {
        makeNukeOverlay(b.lat, b.lon, 'nucleare').addTo(layers.basi);
      }
      // Icona ☢ BIANCA piccola per basi autorizzate a scali di sub nucleari (La Maddalena, Gaeta, Brindisi)
      if (b.scali_nucleari) {
        makeNukeOverlay(b.lat, b.lon, 'nucleare_scalo').addTo(layers.basi);
      }

      // Cerchi di rischio (es. MUOS Niscemi: danno acuto 20 km, interferenza aerea 67 km)
      if (b.raggi_rischio_km) {
        const r = b.raggi_rischio_km;
        if (r.interferenza_aerea) {
          L.circle([b.lat, b.lon], {
            radius: r.interferenza_aerea * 1000,
            color: '#ff2a2a',
            weight: 1,
            opacity: 0.55,
            dashArray: '5 6',
            fillColor: '#ff2a2a',
            fillOpacity: 0.05,
            interactive: false,
            className: 'osv-circle-interferenza'
          }).addTo(layers.basi);
        }
        if (r.danno_acuto) {
          L.circle([b.lat, b.lon], {
            radius: r.danno_acuto * 1000,
            color: '#ff2a2a',
            weight: 1.5,
            opacity: 0.85,
            fillColor: '#ff2a2a',
            fillOpacity: 0.18,
            interactive: false,
            className: 'osv-circle-acuto'
          }).addTo(layers.basi);
        }
      }
    });

    // PRODUZIONE — icona proiettile arancione
    produzione.items.forEach(p => {
      const marker = makeIconMarker(p.lat, p.lon, 'produzione', 'osv-icon-produzione');
      marker.bindPopup(popupProduzione(p), POPUP_OPTS);
      marker.addTo(layers.produzione);
    });

    // PORTI — icona ancora gialla, + ☢ bianca se autorizzato scali nucleari
    porti.items.forEach(p => {
      const marker = makeIconMarker(p.lat, p.lon, 'porto', 'osv-icon-porto');
      marker.bindPopup(popupPorto(p), POPUP_OPTS);
      marker.addTo(layers.porti);
      if (p.scali_nucleari) {
        makeNukeOverlay(p.lat, p.lon, 'nucleare_scalo').addTo(layers.porti);
      }
    });


    // INCIDENTI — triangolo warning bianco
    incidenti.items.forEach(inc => {
      const marker = makeIconMarker(inc.lat, inc.lon, 'incidente', 'osv-icon-incidente');
      marker.bindPopup(popupIncidente(inc), POPUP_OPTS);
      marker.addTo(layers.incidenti);
    });

    // Apertura popup → sposta in body (per liberarlo dal transform del pane)
    mappa.on('popupopen', (e) => {
      document.body.classList.add('mappa-popup-open');
      const el = e.popup.getElement();
      if (el && el.parentElement && el.parentElement !== document.body) {
        el._osvOriginalParent = el.parentElement;
        document.body.appendChild(el);
      }
    });

    // Chiusura popup → pulisci rotte/conflitti se era una base + rimetti popup nel pane
    mappa.on('popupclose', (e) => {
      document.body.classList.remove('mappa-popup-open');
      const el = e.popup.getElement();
      if (el && el._osvOriginalParent) {
        el._osvOriginalParent.appendChild(el);
        delete el._osvOriginalParent;
      }
      const html = e.popup && e.popup.getContent && e.popup.getContent();
      if (typeof html === 'string' && html.includes('popup-base')) {
        layers.linee.clearLayers();
        layers.conflitti.clearLayers();
      }
    });

    // Click sul backdrop chiude il popup.
    // Ignora i click dentro la mappa (Leaflet gestisce già) e dentro un popup.
    document.body.addEventListener('click', (ev) => {
      if (!document.body.classList.contains('mappa-popup-open')) return;
      if (ev.target.closest('#mappa')) return;          // click su marker/mappa: lascia fare a Leaflet
      if (ev.target.closest('.leaflet-popup')) return;  // click dentro popup: niente
      mappa.closePopup();
    });

    // ESC chiude (oltre al default Leaflet, per sicurezza)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.body.classList.contains('mappa-popup-open')) {
        mappa.closePopup();
      }
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

    // Loading off
    const loading = document.getElementById('mappa-loading');
    if (loading) loading.remove();

    // SCALING ICONE in base al zoom — evita sovrapposizioni su vista panoramica
    const mappaEl = document.getElementById('mappa');
    function aggiornaScalaZoom() {
      const z = mappa.getZoom();
      const tier = z <= 6 ? 'low' : (z <= 7 ? 'med' : 'high');
      mappaEl.setAttribute('data-zoom-tier', tier);
      const baseR = z <= 6 ? 3 : (z <= 7 ? 4.5 : 6);
      layers.basi.eachLayer(l => {
        if (l instanceof L.CircleMarker && l.options.className && l.options.className.includes('osv-dot-base')) {
          l.setRadius(baseR);
        }
      });
    }
    mappa.on('zoomend', aggiornaScalaZoom);
    aggiornaScalaZoom();

  }).catch(err => {
    console.error('Errore caricamento dati osservatorio:', err);
    const loading = document.getElementById('mappa-loading');
    if (loading) {
      loading.innerHTML = '<p style="color:#ff2a2a;">Errore nel caricamento della mappa.<br>Ricarica la pagina.</p>';
    }
  });

  // ---------- LINEE BASE → CONFLITTI (al click) ----------
  function disegnaLineeEConflitti(base, conflittiPerId) {
    layers.linee.clearLayers();
    layers.conflitti.clearLayers();
    if (!base.conflitti) return;

    base.conflitti.forEach(cid => {
      const c = conflittiPerId[cid];
      if (!c) return;

      // Pallino grigio sul conflitto
      const pulse = makePulseMarker(c.lat, c.lon, COLORI.conflitti);
      const dotConf = L.circleMarker([c.lat, c.lon], {
        radius: 7,
        color: '#000',
        weight: 1.5,
        fillColor: COLORI.conflitti,
        fillOpacity: 1,
        className: 'osv-dot osv-dot-conflitto'
      });
      dotConf.bindPopup(popupConflitto(c), POPUP_OPTS);
      pulse.addTo(layers.conflitti);
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
    });
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
        ${b.problemi_ambientali && b.problemi_ambientali.length ? `<div class="popup-section popup-warning"><h4>Problemi ambientali</h4>${listToHTML(b.problemi_ambientali)}</div>` : ''}
        ${b.problemi_sanitari && b.problemi_sanitari.length ? `<div class="popup-section popup-warning"><h4>Problemi sanitari</h4>${listToHTML(b.problemi_sanitari)}</div>` : ''}

        ${conflittiHTML ? `<div class="popup-section"><h4>Conflitti collegati</h4>${conflittiHTML}</div>` : ''}

        ${b.fonti && b.fonti.length ? `<details class="popup-fonti"><summary>Fonti (${b.fonti.length})</summary>${listToHTML(b.fonti)}</details>` : ''}
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

        ${p.fonti && p.fonti.length ? `<details class="popup-fonti"><summary>Fonti (${p.fonti.length})</summary>${listToHTML(p.fonti)}</details>` : ''}
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

        ${p.fonti && p.fonti.length ? `<details class="popup-fonti"><summary>Fonti (${p.fonti.length})</summary>${listToHTML(p.fonti)}</details>` : ''}
      </div>
    `;
  }

  function popupConflitto(c) {
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

        ${i.fonti && i.fonti.length ? `<details class="popup-fonti"><summary>Fonti (${i.fonti.length})</summary>${listToHTML(i.fonti)}</details>` : ''}
      </div>
    `;
  }

})();
