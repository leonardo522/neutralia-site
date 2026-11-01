/* ============================================
   NEUTRALIA — Parlamento: emicicli e confronto
   ============================================ */

(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FILE_PER_AULA = { camera: 9, senato: 7 };
  const SETTORI_DEFAULT = 6;

  const stato = { aula: 'camera', gruppo: null, tema: null, partiti: [] };
  const MAX_CONFRONTO = 3;
  let dati = null;
  let aula3d = null;

  const el = (id) => document.getElementById(id);

  function crea(tag, attrs, testo) {
    const nodo = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined) nodo.setAttribute(k, v);
    });
    if (testo !== undefined) nodo.textContent = testo;
    return nodo;
  }

  /* Seggi su file concentriche, divisi in settori da corridoi.
     Ordinati per angolo, così ogni gruppo occupa uno spicchio. */
  function geometria(totale, nFile, nSettori) {
    const rMin = 150, rMax = 420, corridoio = 0.022;
    const raggi = Array.from({ length: nFile }, (_, i) => rMin + (rMax - rMin) * i / (nFile - 1));
    const sommaRaggi = raggi.reduce((a, r) => a + r, 0);

    const perFila = raggi.map((r) => Math.round(totale * r / sommaRaggi));
    let scarto = totale - perFila.reduce((a, n) => a + n, 0);
    for (let i = nFile - 1; scarto !== 0; i = (i + nFile - 1) % nFile) {
      perFila[i] += Math.sign(scarto);
      scarto -= Math.sign(scarto);
    }

    const ampiezzaSettore = (Math.PI - corridoio * (nSettori - 1)) / nSettori;
    const seggi = [];
    raggi.forEach((r, f) => {
      const n = perFila[f];
      for (let s = 0; s < nSettori; s++) {
        const nS = Math.floor(n / nSettori) + (s < n % nSettori ? 1 : 0);
        const inizio = s * (ampiezzaSettore + corridoio);
        for (let i = 0; i < nS; i++) {
          const a = inizio + ampiezzaSettore * (i + 0.5) / nS;
          seggi.push({ x: 450 - r * Math.cos(a), y: 450 - r * Math.sin(a), a });
        }
      }
    });
    return seggi.sort((p, q) => p.a - q.a);
  }

  function disegnaEmiciclo() {
    const aula = dati.composizione[stato.aula];
    if (aula3d) {
      aula3d.imposta(stato.aula, aula.gruppi, aula.seggi);
      notaAula(aula);
      return;
    }
    const nFile = FILE_PER_AULA[stato.aula];
    const seggi = geometria(aula.seggi, nFile, aula.settori || SETTORI_DEFAULT);
    const raggio = stato.aula === 'camera' ? 7.5 : 10;

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 900 470');
    svg.setAttribute('role', 'img');
    const assegnati = aula.gruppi.reduce((a, g) => a + g.seggi, 0);
    svg.setAttribute('aria-label', `Emiciclo: ${assegnati} seggi occupati su ${aula.seggi}, divisi fra ${aula.gruppi.length} gruppi`);

    const banco = document.createElementNS(SVGNS, 'path');
    banco.setAttribute('d', 'M380 450 a70 70 0 0 1 140 0 z');
    banco.setAttribute('class', 'parl-banco');
    svg.appendChild(banco);

    let cursore = 0;
    aula.gruppi.forEach((g, i) => {
      const nodo = document.createElementNS(SVGNS, 'g');
      nodo.setAttribute('data-gruppo', g.id);
      nodo.setAttribute('class', i % 2 ? 'parl-gruppo is-pari' : 'parl-gruppo');
      for (let n = 0; n < g.seggi; n++, cursore++) {
        const p = seggi[cursore];
        const c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', p.x.toFixed(1));
        c.setAttribute('cy', p.y.toFixed(1));
        c.setAttribute('r', raggio);
        nodo.appendChild(c);
      }
      const titolo = document.createElementNS(SVGNS, 'title');
      titolo.textContent = `${g.breve || g.nome}: ${g.seggi}`;
      nodo.appendChild(titolo);
      svg.appendChild(nodo);
    });

    for (; cursore < seggi.length; cursore++) {
      const p = seggi[cursore];
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', p.x.toFixed(1));
      c.setAttribute('cy', p.y.toFixed(1));
      c.setAttribute('r', raggio);
      c.setAttribute('class', 'parl-vacante');
      svg.appendChild(c);
    }

    const box = el('parl-emiciclo');
    box.innerHTML = '';
    box.appendChild(svg);
    box.setAttribute('aria-labelledby', `tab-${stato.aula}`);
    notaAula(aula);
  }

  function notaAula(aula) {
    const assegnati = aula.gruppi.reduce((a, g) => a + g.seggi, 0);
    const vacanti = aula.seggi - assegnati;
    const pezzi = ['Ricostruzione dell\'aula con i seggi reali. I gruppi sono in ordine di consistenza, non nella posizione che occupano davvero.'];
    if (vacanti > 0) pezzi.push(`${vacanti} seggi vacanti.`);
    if (aula.nota) pezzi.push(aula.nota);
    pezzi.push(`Rilevato il ${dataEstesa(dati.composizione.rilevato_il)}.`);
    el('parl-nota-aula').textContent = pezzi.join(' ');
  }

  function disegnaLegenda() {
    const lista = el('parl-legenda');
    lista.innerHTML = '';
    dati.composizione[stato.aula].gruppi.forEach((g) => {
      const b = crea('button', { type: 'button', 'data-gruppo': g.id, title: g.nome });
      const pallino = crea('span', { class: 'parl-legenda-colore', 'aria-hidden': 'true' });
      pallino.style.background = g.colore;
      b.appendChild(pallino);
      if (g.partiti.length === 1) b.appendChild(crea('img', { class: 'parl-legenda-stemma', src: `assets/img/parlamento/stemmi/${g.partiti[0]}.png`, alt: '' }));
      b.appendChild(crea('span', { class: 'parl-legenda-nome' }, g.breve || g.nome));
      b.appendChild(crea('span', { class: 'parl-legenda-num' }, String(g.seggi)));
      lista.appendChild(b);
    });
    aggiornaSelezione();
  }

  function aggiornaSelezione() {
    const attivo = stato.gruppo;
    if (aula3d) aula3d.seleziona(attivo);
    el('parl-emiciclo').classList.toggle('ha-selezione', !!attivo);
    document.querySelectorAll('.parl-gruppo').forEach((g) => {
      g.classList.toggle('is-attivo', g.dataset.gruppo === attivo);
    });
    document.querySelectorAll('#parl-legenda button').forEach((b) => {
      const on = b.dataset.gruppo === attivo;
      b.classList.toggle('is-attivo', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-tema]').forEach((b) => {
      const on = b.dataset.tema === stato.tema;
      b.classList.toggle('is-attivo', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-partito]').forEach((b) => {
      const on = stato.partiti.includes(b.dataset.partito);
      b.classList.toggle('is-attivo', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function dataEstesa(iso) {
    if (!iso) return '';
    const [a, m, g] = iso.split('-').map(Number);
    if (!g) return iso;
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    return `${g} ${mesi[m - 1]} ${a}`;
  }

  function chip(testo, attrs) {
    return crea('button', Object.assign({ type: 'button', class: 'parl-chip', 'aria-pressed': 'false' }, attrs), testo);
  }

  const stemmaPartito = (slug) => `assets/img/parlamento/stemmi/${slug}.png`;

  function disegnaChips() {
    const temi = el('parl-temi');
    dati.temi.forEach((t) => temi.appendChild(chip(t.titolo, { 'data-tema': t.id })));
    const partiti = el('parl-partiti');
    dati.partiti.forEach((p) => {
      const b = chip('', { 'data-partito': p.slug, class: 'parl-chip parl-chip-partito' });
      b.appendChild(crea('img', { src: stemmaPartito(p.slug), alt: '' }));
      b.appendChild(document.createTextNode(p.nome));
      partiti.appendChild(b);
    });
  }

  /* Le citazioni di un partito su un tema, dalla più recente. */
  function vociDi(partito, tema) {
    const voci = (partito.posizioni && partito.posizioni[tema.id]) || [];
    const data = (c) => (dati.documenti[c.documento] && dati.documenti[c.documento].data) || '';
    return voci.slice().sort((a, b) => data(b).localeCompare(data(a)));
  }

  function bloccoCitazione(c) {
    const fig = crea('figure', { class: 'parl-citazione' });
    const doc = dati.documenti[c.documento];
    const paginaWeb = doc && doc.data === dati.composizione.rilevato_il;
    const testa = crea('div', { class: 'parl-citazione-testa' });
    testa.appendChild(crea('span', { class: 'parl-anno' }, paginaWeb ? 'Sito' : (doc && doc.data ? doc.data.slice(0, 4) : '')));
    fig.appendChild(testa);
    fig.appendChild(crea('blockquote', { lang: c.traduzione ? 'de' : null }, c.citazione));
    if (c.traduzione) fig.appendChild(crea('p', { class: 'parl-traduzione' }, `Traduzione: ${c.traduzione}`));
    const cap = crea('figcaption', {});
    const url = doc ? (doc.url_originale || doc.url_archivio) : null;
    const etichetta = doc ? doc.titolo : c.documento;
    if (url) cap.appendChild(crea('a', { href: url, target: '_blank', rel: 'noopener' }, etichetta));
    else cap.appendChild(document.createTextNode(etichetta));
    if (c.pagina) cap.appendChild(document.createTextNode(`, p. ${c.pagina}`));
    fig.appendChild(cap);
    return fig;
  }

  function seggiDi(partito) {
    const conta = (aula) => dati.composizione[aula].gruppi
      .filter((g) => g.partiti.length === 1 && g.partiti[0] === partito.slug)
      .reduce((a, g) => a + g.seggi, 0);
    const pezzi = [];
    if (conta('camera')) pezzi.push(`Camera ${conta('camera')}`);
    if (conta('senato')) pezzi.push(`Senato ${conta('senato')}`);
    return pezzi.join(' · ');
  }

  function testaPartito(partito, tag) {
    const h = crea(tag || 'h3', { class: 'parl-carta-testa' });
    h.appendChild(crea('img', { src: stemmaPartito(partito.slug), alt: '' }));
    const nome = crea('span', {}, partito.nome);
    h.appendChild(nome);
    const seggi = seggiDi(partito);
    if (seggi) h.appendChild(crea('small', {}, seggi));
    return h;
  }

  /* La scheda: la citazione più recente in vista, le altre a richiesta. */
  function cartaPartito(partito, tema) {
    const carta = crea('article', { class: 'parl-carta' });
    carta.appendChild(testaPartito(partito));
    corpoCarta(carta, partito, tema);
    return carta;
  }

  function corpoCarta(box, partito, tema) {
    const voci = vociDi(partito, tema);
    const sommario = partito.sommari && partito.sommari[tema.id];
    if (sommario) {
      const p = crea('p', { class: 'parl-sommario' });
      p.appendChild(crea('strong', {}, 'Sommario'));
      p.appendChild(document.createTextNode(sommario));
      box.appendChild(p);
    }
    if (!voci.length) {
      if (!sommario) box.appendChild(crea('p', { class: 'parl-silenzio' }, 'Non trattato nei documenti esaminati.'));
      return;
    }
    voci.forEach((c) => box.appendChild(bloccoCitazione(c)));
  }

  function esitoGruppi(voto, partito) {
    const righe = voto.gruppi.filter((g) => (partito.gruppi_voto || []).includes(g.gruppo));
    if (!righe.length) return null;
    const somma = (k) => righe.reduce((a, g) => a + (g[k] || 0), 0);
    return { si: somma('favorevoli'), no: somma('contrari'), ast: somma('astenuti') };
  }

  /* I voti su una griglia: una riga per voto, una colonna per partito. */
  function tabellaVoti(tema, partiti) {
    const voti = dati.voti.filter((v) => v.tema === tema.id).sort((a, b) => b.data.localeCompare(a.data));
    const colonne = partiti;
    if (!voti.length) return null;
    const box = crea('section', { class: 'parl-voti' });
    box.appendChild(crea('h4', {}, 'Come hanno votato'));
    const scorri = crea('div', { class: 'parl-voti-scorri' });
    const tab = crea('table', {});
    const tr0 = crea('tr', {});
    tr0.appendChild(crea('th', { scope: 'col' }, 'Voto'));
    colonne.forEach((p) => {
      const th = crea('th', { scope: 'col', title: p.nome });
      th.appendChild(crea('img', { src: stemmaPartito(p.slug), alt: p.nome }));
      tr0.appendChild(th);
    });
    tab.appendChild(crea('thead')).appendChild(tr0);
    const corpo = tab.appendChild(crea('tbody'));
    voti.forEach((v) => {
      const tr = crea('tr', {});
      const th = crea('th', { scope: 'row' });
      const det = crea('details', {});
      det.appendChild(crea('summary', {}, v.titolo_neutro));
      det.appendChild(crea('p', {}, v.cosa_si_votava));
      th.appendChild(det);
      const piede = crea('small', {}, `${v.ramo === 'camera' ? 'Camera' : 'Senato'}, ${dataEstesa(v.data)} · ${v.esito} · `);
      piede.appendChild(crea('a', { href: v.url_fonte, target: '_blank', rel: 'noopener' }, 'fonte'));
      th.appendChild(piede);
      tr.appendChild(th);
      colonne.forEach((p) => {
        const e = esitoGruppi(v, p);
        if (!e) {
          tr.appendChild(crea('td', { class: 'parl-v-assente', title: `${p.nome}: nessun gruppo o componente propria in questo voto` }, '–'));
          return;
        }
        const m = Math.max(e.si, e.no, e.ast);
        const [cl, testo] = m === 0 ? ['parl-v-assente', '–'] : m === e.si ? ['parl-v-si', 'Sì'] : m === e.no ? ['parl-v-no', 'No'] : ['parl-v-ast', 'Ast.'];
        tr.appendChild(crea('td', { class: cl, title: `${p.nome}: ${e.si} favorevoli, ${e.no} contrari, ${e.ast} astenuti` }, testo));
      });
      corpo.appendChild(tr);
    });
    scorri.appendChild(tab);
    box.appendChild(scorri);
    box.appendChild(crea('p', { class: 'parl-nota' }, 'In tabella la scelta della maggioranza del gruppo: passando sopra una casella si leggono i numeri. Il trattino indica che in quel voto il partito non aveva un gruppo o una componente propria, oppure che nessuno dei suoi ha votato.'));
    return box;
  }

  function vistaTema(box, tema) {
    box.appendChild(crea('h3', { class: 'parl-titolo-vista' }, tema.titolo));
    const chiParla = dati.partiti.filter((p) => vociDi(p, tema).length);
    const griglia = crea('div', { class: 'parl-griglia' });
    chiParla.forEach((p) => griglia.appendChild(cartaPartito(p, tema)));
    box.appendChild(griglia);
    const muti = dati.partiti.filter((p) => !vociDi(p, tema).length);
    if (muti.length) box.appendChild(crea('p', { class: 'parl-silenzio' }, `Non trattato nei documenti esaminati da: ${muti.map((p) => p.nome).join(', ')}.`));
    const v = tabellaVoti(tema, dati.partiti);
    if (v) box.appendChild(v);
  }

  function vistaPartito(box, partito) {
    const testa = testaPartito(partito);
    testa.classList.add('parl-profilo');
    box.appendChild(testa);
    if (partito.sommari) {
      const dl = crea('dl', { class: 'parl-riassunto' });
      dati.temi.forEach((t) => {
        const riga = crea('div', {});
        riga.appendChild(crea('dt', {}, t.titolo));
        riga.appendChild(crea('dd', {}, partito.sommari[t.id] || 'Non trattato nei documenti esaminati.'));
        dl.appendChild(riga);
      });
      box.appendChild(dl);
    }
    dati.temi.forEach((t, i) => {
      const n = vociDi(partito, t).length;
      const sez = crea('details', { class: 'parl-tema', open: i === 0 ? '' : null });
      const s = crea('summary', {}, t.titolo);
      s.appendChild(crea('span', { class: 'parl-conta' }, n ? String(n) : '–'));
      sez.appendChild(s);
      corpoCarta(sez, partito, t);
      const v = tabellaVoti(t, [partito]);
      if (v) sez.appendChild(v);
      box.appendChild(sez);
    });
  }

  function vistaConfronto(box, partiti, temi) {
    temi.forEach((t) => {
      box.appendChild(crea('h3', { class: 'parl-titolo-vista' }, t.titolo));
      const griglia = crea('div', { class: `parl-affianco parl-col-${partiti.length}` });
      partiti.forEach((p) => {
        griglia.appendChild(cartaPartito(p, t));
      });
      box.appendChild(griglia);
      const v = tabellaVoti(t, partiti);
      if (v) box.appendChild(v);
    });
  }

  function disegnaRisultati() {
    const box = el('parl-risultati');
    box.innerHTML = '';
    const tema = dati.temi.find((t) => t.id === stato.tema);
    const scelti = stato.partiti.map((s) => dati.partiti.find((p) => p.slug === s)).filter(Boolean);
    if (scelti.length) {
      const azzera = crea('button', { type: 'button', class: 'parl-azzera' }, 'Togli la scelta dei partiti');
      azzera.addEventListener('click', () => {
        stato.partiti = [];
        stato.gruppo = null;
        aggiorna();
      });
      box.appendChild(azzera);
    }
    if (scelti.length > 1) vistaConfronto(box, scelti, tema ? [tema] : dati.temi);
    else if (scelti.length === 1 && tema) vistaConfronto(box, scelti, [tema]);
    else if (scelti.length === 1) vistaPartito(box, scelti[0]);
    else if (tema) vistaTema(box, tema);
  }

  function disegnaMetodo() {
    const box = el('parl-metodo');
    (dati.metodo || []).forEach((testo) => box.appendChild(crea('p', {}, testo)));
    const elenco = Object.values(dati.documenti);
    if (elenco.length) {
      const d = crea('details', { class: 'parl-documenti' });
      d.appendChild(crea('summary', {}, `I documenti esaminati (${elenco.length})`));
      const ul = crea('ul', {});
      elenco.forEach((doc) => {
        const li = crea('li', {});
        const url = doc.url_originale || doc.url_archivio;
        if (url) li.appendChild(crea('a', { href: url, target: '_blank', rel: 'noopener' }, doc.titolo));
        else li.textContent = doc.titolo;
        ul.appendChild(li);
      });
      d.appendChild(ul);
      box.appendChild(d);
    }
  }

  function leggiIndirizzo() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (dati.temi.some((t) => t.id === q.get('tema'))) stato.tema = q.get('tema');
    stato.partiti = (q.get('partiti') || '').split(',').filter((s) => dati.partiti.some((p) => p.slug === s)).slice(0, MAX_CONFRONTO);
    if (!stato.tema && !stato.partiti.length) stato.tema = dati.temi[0].id;
  }

  function scriviIndirizzo() {
    const q = new URLSearchParams();
    if (stato.tema) q.set('tema', stato.tema);
    if (stato.partiti.length) q.set('partiti', stato.partiti.join(','));
    try {
      history.replaceState(null, '', q.toString() ? `#${q}` : location.pathname);
    } catch (e) {
      /* in alcune anteprime l'indirizzo non si può cambiare: la pagina funziona lo stesso */
    }
  }

  function aggiorna() {
    aggiornaSelezione();
    disegnaRisultati();
    scriviIndirizzo();
  }

  function scegliGruppo(id) {
    const g = dati.composizione[stato.aula].gruppi.find((x) => x.id === id);
    if (!g) return;
    const toglie = stato.gruppo === id;
    stato.gruppo = toglie ? null : id;
    const noti = g.partiti.filter((s) => dati.partiti.some((p) => p.slug === s));
    stato.partiti = toglie ? [] : noti.slice(0, MAX_CONFRONTO);
    aggiorna();
  }

  function scegliAula(aula) {
    stato.aula = aula;
    stato.gruppo = null;
    document.querySelectorAll('[role="tab"]').forEach((t) => {
      const on = t.dataset.aula === aula;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    disegnaEmiciclo();
    disegnaLegenda();
  }

  function preparaAula3d() {
    if (!window.ParlAula || !ParlAula.disponibile()) return;
    const box = el('parl-emiciclo');
    const tela = crea('canvas', { class: 'parl-tela', role: 'img', 'aria-label': 'Ricostruzione tridimensionale dell\'aula. I gruppi si scelgono anche dall\'elenco qui sotto.' });
    const etichetta = crea('div', { class: 'parl-etichetta-seggio', hidden: '' });
    box.classList.add('parl-3d');
    box.appendChild(tela);
    box.appendChild(etichetta);
    box.appendChild(crea('p', { class: 'parl-aiuto' }, 'Tocca un seggio. Usa + e − per avvicinarti.'));
    const comandi = crea('div', { class: 'parl-zoom' });
    [['+', 'Avvicina', 1.6], ['−', 'Allontana', 0.625]].forEach(([testo, nome, fattore]) => {
      const b = crea('button', { type: 'button', 'aria-label': nome }, testo);
      b.addEventListener('click', () => aula3d.ingrandisci(fattore));
      comandi.appendChild(b);
    });
    box.appendChild(comandi);
    const stemmi = [];
    ['camera', 'senato'].forEach((a) => dati.composizione[a].gruppi.forEach((g) => {
      g.stemma = g.partiti.length === 1 ? `assets/img/parlamento/stemmi/${g.partiti[0]}.png` : null;
      if (g.stemma && !stemmi.includes(g.stemma)) stemmi.push(g.stemma);
    }));
    aula3d = ParlAula.crea(tela, {
      stemmi,
      quandoScegli: scegliGruppo,
      quandoSopra(id, x, y) {
        const g = id && dati.composizione[stato.aula].gruppi.find((v) => v.id === id);
        etichetta.hidden = !g;
        if (!g) return;
        etichetta.textContent = `${g.breve || g.nome} · ${g.seggi}`;
        etichetta.style.left = `${x}px`;
        etichetta.style.top = `${y}px`;
      }
    });
    if (!aula3d) box.innerHTML = '';
  }

  function collega() {
    document.querySelectorAll('[role="tab"]').forEach((t) => {
      t.addEventListener('click', () => scegliAula(t.dataset.aula));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const altro = t.dataset.aula === 'camera' ? 'senato' : 'camera';
        scegliAula(altro);
        el(`tab-${altro}`).focus();
      });
    });
    el('parl-emiciclo').addEventListener('click', (e) => {
      const g = e.target.closest('[data-gruppo]');
      if (g && !aula3d) scegliGruppo(g.dataset.gruppo);
    });
    el('parl-legenda').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) scegliGruppo(b.dataset.gruppo);
    });
    document.querySelector('.parl-confronto').addEventListener('click', (e) => {
      const b = e.target.closest('.parl-chip');
      if (!b) return;
      if (b.dataset.tema) stato.tema = stato.tema === b.dataset.tema ? null : b.dataset.tema;
      if (b.dataset.partito) {
        const s = b.dataset.partito;
        stato.partiti = stato.partiti.includes(s) ? stato.partiti.filter((x) => x !== s) : [...stato.partiti, s].slice(-MAX_CONFRONTO);
        stato.gruppo = null;
      }
      aggiorna();
    });
  }

  fetch(document.documentElement.dataset.datiParlamento || 'assets/data/parlamento.json')
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((json) => {
      dati = json;
      disegnaChips();
      disegnaMetodo();
      preparaAula3d();
      collega();
      leggiIndirizzo();
      scegliAula('camera');
      aggiorna();
    })
    .catch(() => {
      el('parl-emiciclo').appendChild(crea('p', { class: 'parl-vuoto' }, 'Dati non disponibili. Ricarica la pagina.'));
    });
})();
