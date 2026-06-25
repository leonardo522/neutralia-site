/* ============================================
   NEUTRALIA — Osservatorio tematico (libreria riusabile)
   Usato da: osservatorio-energetico, -industriale, -digitale, -racconto.
   Schema JSON unificato: ogni elemento ha id, nome, lat, lon, kind,
   titolo, sottotitolo, descrizione, fatti, fonti.
   ============================================ */

(function (global) {
  'use strict';

  const POPUP_OPTS = {
    maxWidth: 1000,
    minWidth: 0,
    autoPan: false,
    keepInView: false,
    closeOnEscapeKey: true,
    className: 'osv-popup'
  };

  // ---------- HELPERS ----------
  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function listToHTML(arr) {
    if (!arr || !arr.length) return '';
    return '<ul>' + arr.map(x => `<li>${escapeHTML(x)}</li>`).join('') + '</ul>';
  }

  function popupHTML(item, themeClass) {
    const fattiHTML = item.fatti && item.fatti.length
      ? `<div class="popup-section"><h4>Fatti documentati</h4>${listToHTML(item.fatti)}</div>` : '';
    const fontiHTML = item.fonti && item.fonti.length
      ? `<details class="popup-fonti"><summary>Fonti (${item.fonti.length})</summary>${listToHTML(item.fonti)}</details>` : '';
    const valoriHTML = item.valori && item.valori.length
      ? '<div class="popup-stats">' + item.valori.map(v =>
          `<div class="popup-stat-row"><strong>${escapeHTML(v.label)}</strong><span>${escapeHTML(v.value)}</span></div>`
        ).join('') + '</div>' : '';
    const paeseHTML = item.paese_controllo
      ? `<p class="popup-flag"><strong>Controllo:</strong> ${escapeHTML(item.paese_controllo)}</p>` : '';
    const annoHTML = item.anno
      ? `<p class="popup-anno"><strong>Anno:</strong> ${escapeHTML(String(item.anno))}</p>` : '';

    return `
      <div class="popup popup-${themeClass} popup-kind-${item.kind || 'default'}">
        ${item.eyebrow ? `<p class="popup-eyebrow popup-eyebrow-${themeClass}">${escapeHTML(item.eyebrow)}</p>` : ''}
        <h3>${escapeHTML(item.nome)}</h3>
        ${item.sottotitolo ? `<p class="popup-loc">${escapeHTML(item.sottotitolo)}</p>` : ''}
        ${item.tipo ? `<p class="popup-tipo">${escapeHTML(item.tipo)}</p>` : ''}
        ${paeseHTML}
        ${annoHTML}
        ${item.descrizione ? `<p class="popup-funzione">${escapeHTML(item.descrizione)}</p>` : ''}
        ${valoriHTML}
        ${fattiHTML}
        ${fontiHTML}
      </div>
    `;
  }

  // ---------- MAIN INIT ----------
  /**
   * config = {
   *   theme: 'energetico' | 'industriale' | 'digitale' | 'racconto',
   *   dataPath: 'assets/data/osservatorio-energetico.json',
   *   center: [42.3, 12.5],
   *   zoom: 6,
   *   kinds: { kindName: { color, svg, label } }   // marker types
   * }
   */
  function init(config) {
    if (!config || !config.dataPath || !config.theme) {
      console.error('[osservatorio-tema] missing config');
      return;
    }

    const mappa = L.map('mappa', {
      center: config.center || [42.3, 12.5],
      zoom: config.zoom || 6,
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

    window.NeutraliaMap = mappa;

    // Group markers by kind for filter
    const groups = {};
    Object.keys(config.kinds || {}).forEach(k => {
      groups[k] = L.layerGroup().addTo(mappa);
    });

    // Italia confine (sempre il bellico geojson, è solo il bordo)
    fetch('assets/data/italia.geojson')
      .then(r => r.json())
      .then(geo => {
        L.geoJSON(geo, {
          style: {
            color: '#ffffff',
            weight: 1.2,
            opacity: 0.95,
            fillColor: '#111',
            fillOpacity: 0.55
          },
          interactive: false
        }).addTo(mappa);
      })
      .catch(() => { /* non bloccante */ });

    // Carica dati tema (supporta fetchOpts per endpoint protetti con credentials)
    fetch(config.dataPath, config.fetchOpts || {})
      .then(r => r.json())
      .then(data => {
        const items = data.items || [];
        items.forEach(item => {
          if (item.lat == null || item.lon == null) return;
          const kindCfg = (config.kinds && config.kinds[item.kind]) || {
            color: '#ff2a2a', label: item.kind || ''
          };

          let marker;
          if (kindCfg.svg) {
            // divIcon
            const icon = L.divIcon({
              className: `osv-icon-marker osv-tema-${config.theme} kind-${item.kind}`,
              html: `<span class="osv-icon-svg" style="color:${kindCfg.color}">${kindCfg.svg}</span>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -16]
            });
            marker = L.marker([item.lat, item.lon], { icon });
          } else {
            // CircleMarker
            marker = L.circleMarker([item.lat, item.lon], {
              radius: 8,
              color: '#000',
              weight: 1.5,
              fillColor: kindCfg.color,
              fillOpacity: 1,
              className: `osv-dot osv-tema-${config.theme} kind-${item.kind}`,
              bubblingMouseEvents: false
            });

            // Pulse alone
            const pulse = L.circleMarker([item.lat, item.lon], {
              radius: 9,
              color: kindCfg.color,
              weight: 0,
              fillColor: kindCfg.color,
              fillOpacity: 0.45,
              className: 'osv-pulse',
              interactive: false
            });
            pulse.addTo(groups[item.kind] || mappa);
          }

          marker.bindPopup(popupHTML(item, config.theme), POPUP_OPTS);
          marker.addTo(groups[item.kind] || mappa);
        });

        // Popup as modal centered (riuso del bellico)
        mappa.on('popupopen', (e) => {
          document.body.classList.add('mappa-popup-open');
          const el = e.popup.getElement();
          if (el && el.parentElement && el.parentElement !== document.body) {
            el._osvOriginalParent = el.parentElement;
            document.body.appendChild(el);
          }
        });
        mappa.on('popupclose', (e) => {
          document.body.classList.remove('mappa-popup-open');
          const el = e.popup.getElement();
          if (el && el._osvOriginalParent) {
            el._osvOriginalParent.appendChild(el);
            delete el._osvOriginalParent;
          }
        });
        document.body.addEventListener('click', (ev) => {
          if (!document.body.classList.contains('mappa-popup-open')) return;
          if (ev.target.closest('#mappa')) return;
          if (ev.target.closest('.leaflet-popup')) return;
          mappa.closePopup();
        });
        document.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape' && document.body.classList.contains('mappa-popup-open')) {
            mappa.closePopup();
          }
        });

        // Filter checkboxes
        document.querySelectorAll('[data-filter]').forEach(input => {
          input.addEventListener('change', () => {
            const key = input.dataset.filter;
            if (!groups[key]) return;
            if (input.checked) {
              mappa.addLayer(groups[key]);
            } else {
              mappa.removeLayer(groups[key]);
            }
          });
        });

        // Loading off
        const loading = document.getElementById('mappa-loading');
        if (loading) loading.remove();
      })
      .catch(err => {
        console.error('[osservatorio-tema] errore caricamento dati:', err);
        const loading = document.getElementById('mappa-loading');
        if (loading) {
          loading.innerHTML = '<p style="color:#ff2a2a;">Errore nel caricamento della mappa.<br>Ricarica la pagina.</p>';
        }
      });
  }

  global.OsservatorioTema = { init };
})(window);
