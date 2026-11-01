/* ============================================
   NEUTRALIA — Parlamento: aule in 3D (WebGL2, senza librerie)
   Misure in metri, ricostruite dalle fotografie. θ = 0 è il fondo
   dell'emiciclo; la presidenza sta dalla parte opposta e la vista
   iniziale guarda l'aula da lì, di fronte ai seggi.
   ============================================ */

window.ParlAula = (function () {
  const LEGNO = 1, TESSUTO = 2, LUCE = 3, OTTONE = 4, PELLE = 5;

  const AULE = {
    camera: {
      file: 9, settori: 8, rInt: 7.4, passo: 1.0, alzata: 0.44, ampiezza: 1.78, rMuro: 17.6, fondo: 9.6,
      tribuna: 5.0, parapetto: 0.9, alto: 10.5, cornice: 0.7, campate: 12, loggia: 3.2, sedile: [0.44, 0.08, 0.09],
      vista: { el: 0.23, dist: 22.5, t: [0, 3.4, -5.5] },
      colori: {
        pavimento: [0.50, 0.52, 0.44], gradino: [0.34, 0.07, 0.08], scala: [0.40, 0.46, 0.34], bordo: [0.74, 0.60, 0.30],
        banco: [0.38, 0.21, 0.11], chiaro: [0.47, 0.27, 0.14], piano: [0.13, 0.30, 0.25], muro: [0.30, 0.16, 0.09],
        velluto: [0.56, 0.08, 0.10], colonna: [0.40, 0.22, 0.12], capitello: [0.30, 0.17, 0.09], lampada: [1.0, 0.86, 0.6],
        intonaco: [0.78, 0.50, 0.40], nicchia: [0.96, 0.66, 0.50], drappo: [0.30, 0.13, 0.11], vetro: [0.93, 0.92, 0.84]
      }
    },
    senato: {
      file: 7, settori: 6, rInt: 6.2, passo: 1.2, alzata: 0.36, ampiezza: 1.62, rMuro: 15.8, fondo: 8.2,
      tribuna: 3.9, parapetto: 1.1, alto: 10.6, cornice: 0.6, campate: 14, loggia: 2.8, sedile: [0.82, 0.30, 0.20],
      vista: { el: 0.24, dist: 20, t: [0, 2.8, -4.5] },
      colori: {
        pavimento: [0.58, 0.07, 0.10], gradino: [0.58, 0.07, 0.10], scala: [0.62, 0.09, 0.11], bordo: [0.78, 0.62, 0.28],
        banco: [0.42, 0.20, 0.09], chiaro: [0.52, 0.29, 0.12], piano: [0.46, 0.26, 0.11], muro: [0.36, 0.15, 0.08],
        velluto: [0.60, 0.08, 0.10], colonna: [0.34, 0.14, 0.09], capitello: [0.80, 0.62, 0.26], lampada: [1.0, 0.86, 0.6],
        intarsio: [0.72, 0.46, 0.18]
      }
    }
  };

  const VS = `#version 300 es
  layout(location=0) in vec3 p;
  layout(location=1) in vec3 n;
  layout(location=2) in vec3 c;
  layout(location=3) in vec2 t;
  layout(location=4) in float m;
  layout(location=5) in vec4 ist;
  layout(location=6) in vec3 istc;
  layout(location=7) in vec2 logo;
  uniform mat4 vp, lvp;
  uniform float istanza, stemma;
  out vec3 vn, vc, vw;
  out vec2 vt;
  out vec4 vl;
  flat out float vm;
  flat out float vluce;
  void main() {
    vec3 q = p, r = n, col = c;
    vec2 uv = t;
    vluce = logo.y;
    if (stemma > 0.5) {
      if (logo.x < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      uv = (vec2(mod(logo.x, 4.0), floor(logo.x / 4.0)) + t) / 4.0;
    }
    if (istanza > 0.5) {
      float s = sin(ist.w), k = cos(ist.w);
      q = vec3(k * p.x + s * p.z, p.y, -s * p.x + k * p.z) + ist.xyz;
      r = vec3(k * n.x + s * n.z, n.y, -s * n.x + k * n.z);
      if (m > 4.5) col = istc;
    }
    vn = r; vc = col; vt = uv; vw = q; vm = m;
    vl = lvp * vec4(q, 1.0);
    gl_Position = vp * vec4(q, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  precision highp sampler2DShadow;
  in vec3 vn, vc, vw;
  in vec2 vt;
  in vec4 vl;
  flat in float vm;
  flat in float vluce;
  uniform sampler2D tex;
  uniform sampler2DShadow ombraTex;
  uniform vec3 occhio;
  uniform float usaTex, istanza, stemma;
  uniform vec2 loggia;
  out vec4 uscita;
  float caso(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float ombra() {
    vec3 q = vl.xyz / vl.w * 0.5 + 0.5;
    q.z -= 0.0012;
    float s = 0.0;
    s += textureOffset(ombraTex, q, ivec2(-1, -1));
    s += textureOffset(ombraTex, q, ivec2(1, -1));
    s += textureOffset(ombraTex, q, ivec2(-1, 1));
    s += textureOffset(ombraTex, q, ivec2(1, 1));
    return s * 0.25;
  }
  void main() {
    if (stemma > 0.5) {
      vec4 k = texture(tex, vt);
      if (k.a < 0.5) discard;
      uscita = vec4(k.rgb * vluce, 1.0);
      return;
    }
    if (usaTex > 0.5) { uscita = vec4(texture(tex, vt).rgb * 0.86, 1.0); return; }
    if (vm > 2.5 && vm < 3.5) { uscita = vec4(min(vc, vec3(1.0)), 1.0); return; }
    vec3 N = normalize(vn);
    vec3 V = normalize(occhio - vw);
    vec3 L = normalize(vec3(0.22, 1.0, 0.18));
    vec3 a = pow(vc, vec3(2.2));
    float lucido = 0.0, duro = 30.0;
    float vicino = 1.0 - smoothstep(0.004, 0.02, fwidth(vw.x) + fwidth(vw.y) + fwidth(vw.z));
    if (vm > 0.5 && vm < 1.5) {
      float g = sin((vw.x * 0.7 + vw.z * 0.5 + vw.y * 5.0) * 26.0 + sin(vw.y * 37.0 + vw.x * 3.0) * 2.0) * 0.5 + 0.5;
      a *= mix(0.975, mix(0.90, 1.05, g), vicino);
      lucido = 0.16; duro = 42.0;
    } else if (vm > 1.5 && vm < 2.5) {
      a *= mix(1.0, 0.90 + 0.2 * caso(floor(vw * 70.0)), vicino);
    } else if (vm > 3.5 && vm < 4.5) {
      lucido = 0.7; duro = 64.0;
    } else if (vm > 4.5) {
      lucido = 0.13; duro = 22.0;
    }
    float d = max(dot(N, L), 0.0) * ombra();
    vec3 cielo = mix(vec3(0.20, 0.15, 0.12), vec3(0.50, 0.46, 0.40), N.y * 0.5 + 0.5);
    float fronte = max(dot(N, normalize(vec3(0.0, 0.25, 1.0))), 0.0);
    vec3 col = a * (cielo + fronte * vec3(0.44, 0.36, 0.28) + d * vec3(1.15, 1.05, 0.90));
    col += lucido * pow(max(dot(N, normalize(L + V)), 0.0), duro) * vec3(1.0, 0.92, 0.8);
    if (istanza > 0.5 && vm > 4.5) col += a * 0.34;
    col *= mix(1.0, 0.42, smoothstep(loggia.x, loggia.y, length(vw.xz)) * smoothstep(3.0, 5.0, vw.y));
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    uscita = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
  }`;

  const FS_OMBRA = `#version 300 es
  precision highp float;
  out vec4 o;
  void main() { o = vec4(1.0); }`;

  function disponibile() {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  /* ---- forme ---- */

  function Forma() {
    this.dati = [];
  }

  Forma.prototype.vertice = function (v, n, c, uv, tipo) {
    this.dati.push(v[0], v[1], v[2], n[0], n[1], n[2], c[0], c[1], c[2], uv[0], uv[1], tipo || 0);
  };

  Forma.prototype.quad = function (a, b, c, d, col, uv, tipo) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const m = [n[0] / l, n[1] / l, n[2] / l];
    const t = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]].forEach(([p, i]) => this.vertice(p, m, col, t[i], tipo));
  };

  Forma.prototype.scatola = function (x0, x1, y0, y1, z0, z1, col, tipo, sopra, tipoSopra) {
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], sopra || col, null, tipoSopra || tipo);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, null, tipo);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, null, tipo);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, null, tipo);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, null, tipo);
  };

  const polare = (r, th, y) => [r * Math.sin(th), y, -r * Math.cos(th)];

  Forma.prototype.anello = function (r0, r1, y0, y1, t0, t1, col, tipo, sopra, tipoSopra) {
    const passi = Math.max(3, Math.ceil(Math.abs(t1 - t0) * r1 / 0.5));
    for (let i = 0; i < passi; i++) {
      const ta = t0 + (t1 - t0) * i / passi, tb = t0 + (t1 - t0) * (i + 1) / passi;
      this.quad(polare(r0, tb, y1), polare(r1, tb, y1), polare(r1, ta, y1), polare(r0, ta, y1), sopra || col, null, tipoSopra || tipo);
      this.quad(polare(r0, ta, y0), polare(r0, tb, y0), polare(r0, tb, y1), polare(r0, ta, y1), col, null, tipo);
      this.quad(polare(r1, tb, y0), polare(r1, ta, y0), polare(r1, ta, y1), polare(r1, tb, y1), col, null, tipo);
    }
    this.quad(polare(r1, t0, y0), polare(r0, t0, y0), polare(r0, t0, y1), polare(r1, t0, y1), col, null, tipo);
    this.quad(polare(r0, t1, y0), polare(r1, t1, y0), polare(r1, t1, y1), polare(r0, t1, y1), col, null, tipo);
  };

  /* Superficie curva vista dall'interno: muro se i raggi coincidono, altrimenti cono. */
  Forma.prototype.cono = function (r0, y0, r1, y1, t0, t1, col, tipo, ripeti) {
    const passi = Math.max(4, Math.ceil(Math.abs(t1 - t0) * Math.max(r0, r1) / 0.7));
    const giri = ripeti || 1;
    for (let i = 0; i < passi; i++) {
      const ta = t0 + (t1 - t0) * i / passi, tb = t0 + (t1 - t0) * (i + 1) / passi;
      const ua = giri * i / passi, ub = giri * (i + 1) / passi;
      this.quad(polare(r0, ta, y0), polare(r0, tb, y0), polare(r1, tb, y1), polare(r1, ta, y1), col,
        [[ua, 1], [ub, 1], [ub, 0], [ua, 0]], tipo);
    }
  };

  Forma.prototype.tronco = function (x, z, r0, r1, y0, y1, col, tipo, scanalature) {
    const lati = scanalature ? scanalature * 3 : 14;
    const bordo = (r, a) => r * (1 + (scanalature ? 0.035 * Math.cos(a * scanalature) : 0));
    for (let i = 0; i < lati; i++) {
      const a = i / lati * Math.PI * 2, b = (i + 1) / lati * Math.PI * 2;
      const na = [Math.sin(a), 0, Math.cos(a)], nb = [Math.sin(b), 0, Math.cos(b)];
      const p = (r, an, y) => [x + bordo(r, an) * Math.sin(an), y, z + bordo(r, an) * Math.cos(an)];
      const v = [[p(r0, a, y0), na], [p(r0, b, y0), nb], [p(r1, b, y1), nb], [p(r0, a, y0), na], [p(r1, b, y1), nb], [p(r1, a, y1), na]];
      v.forEach(([q, n]) => this.vertice(q, n, col, [0, 0], tipo));
    }
  };

  Forma.prototype.drappo = function (r, y0, y1, t0, t1, pieghe, col) {
    const passi = pieghe * 6;
    for (let i = 0; i < passi; i++) {
      const fa = i / passi, fb = (i + 1) / passi;
      const ra = r - 0.1 - 0.09 * Math.sin(fa * pieghe * Math.PI * 2);
      const rb = r - 0.1 - 0.09 * Math.sin(fb * pieghe * Math.PI * 2);
      const ta = t0 + (t1 - t0) * fa, tb = t0 + (t1 - t0) * fb;
      this.quad(polare(ra, ta, y0), polare(rb, tb, y0), polare(rb, tb, y1), polare(ra, ta, y1), col, null, TESSUTO);
    }
  };

  function settori(cfg) {
    const corridoio = 1.1 / (cfg.rInt + cfg.file * cfg.passo * 0.5);
    const largo = (cfg.ampiezza * 2 - corridoio * (cfg.settori - 1)) / cfg.settori;
    return Array.from({ length: cfg.settori }, (_, s) => {
      const t0 = -cfg.ampiezza + s * (largo + corridoio);
      return [t0, t0 + largo];
    });
  }

  function seggi(cfg, totale) {
    const raggi = Array.from({ length: cfg.file }, (_, i) => cfg.rInt + i * cfg.passo);
    const somma = raggi.reduce((a, r) => a + r, 0);
    const perFila = raggi.map((r) => Math.round(totale * r / somma));
    let scarto = totale - perFila.reduce((a, n) => a + n, 0);
    for (let i = cfg.file - 1; scarto !== 0; i = (i + cfg.file - 1) % cfg.file) {
      perFila[i] += Math.sign(scarto);
      scarto -= Math.sign(scarto);
    }
    const lista = [];
    const spicchi = settori(cfg);
    raggi.forEach((r, f) => {
      const n = perFila[f];
      spicchi.forEach(([t0, t1], s) => {
        const nS = Math.floor(n / cfg.settori) + (s < n % cfg.settori ? 1 : 0);
        for (let i = 0; i < nS; i++) {
          lista.push({ th: t0 + (t1 - t0) * (i + 0.5) / nS, r, y: (f + 1) * cfg.alzata });
        }
      });
    });
    return lista.sort((a, b) => b.th - a.th);
  }

  /* ---- l'interno: seggi, banchi, presidenza ---- */

  function costruisciInterno(cfg) {
    const c = cfg.colori;
    const f = new Forma();
    const R = cfg.rMuro;
    const limite = Math.acos(-cfg.fondo / R);
    const spicchi = settori(cfg);
    const bianco = [0.82, 0.80, 0.74];

    f.quad([-R - 3, 0, cfg.fondo + 1], [R + 3, 0, cfg.fondo + 1], [R + 3, 0, -R - 3], [-R - 3, 0, -R - 3], c.pavimento, null, TESSUTO);

    for (let i = 0; i < cfg.file; i++) {
      const r = cfg.rInt + i * cfg.passo;
      const y = (i + 1) * cfg.alzata;
      const r0 = r - cfg.passo * 0.55, r1 = r + cfg.passo * 0.45;

      spicchi.forEach(([t0, t1]) => {
        f.anello(r0, r1, 0, y, t0, t1, c.banco, LEGNO, c.gradino, TESSUTO);
        f.anello(r - 0.70, r - 0.66, y, y + 0.72, t0, t1, c.banco, LEGNO);
        f.anello(r - 0.72, r - 0.64, y + 0.10, y + 0.15, t0, t1, c.chiaro, LEGNO);
        f.anello(r - 0.76, r - 0.32, y + 0.72, y + 0.77, t0, t1, c.banco, LEGNO, c.chiaro, LEGNO);
        f.anello(r - 0.71, r - 0.37, y + 0.77, y + 0.78, t0, t1, c.piano, PELLE);
      });

      for (let s = 0; s < spicchi.length - 1; s++) {
        const a = spicchi[s][1], b = spicchi[s + 1][0];
        const salita = cfg.alzata / 2, meta = (r0 + r1) / 2;
        f.anello(r0, meta, 0, y - salita, a, b, c.scala, TESSUTO);
        f.anello(meta, r1, 0, y, a, b, c.scala, TESSUTO);
        f.anello(r0 + 0.01, r0 + 0.05, y - salita, y - salita + 0.03, a, b, c.bordo, OTTONE);
        f.anello(meta + 0.01, meta + 0.05, y, y + 0.03, a, b, c.bordo, OTTONE);
      }
    }

    /* Corrimani in ottone ai due estremi dell'emiciclo. */
    [-cfg.ampiezza - 0.06, cfg.ampiezza + 0.06].forEach((th) => {
      for (let i = 0; i < cfg.file; i++) {
        const r = cfg.rInt + i * cfg.passo;
        const a = polare(r - cfg.passo * 0.5, th, (i + 1) * cfg.alzata + 0.95);
        const b = polare(r + cfg.passo * 0.5, th, (i + 2) * cfg.alzata + 0.95);
        f.quad([a[0] - 0.03, a[1], a[2]], [a[0] + 0.03, a[1], a[2]], [b[0] + 0.03, b[1], b[2]], [b[0] - 0.03, b[1], b[2]], c.bordo, null, OTTONE);
        f.tronco(a[0], a[2], 0.025, 0.025, (i + 1) * cfg.alzata, a[1], c.bordo, OTTONE);
      }
    });

    const rEsterno = cfg.rInt + (cfg.file - 0.5) * cfg.passo;
    const quota = cfg.file * cfg.alzata + 0.25;
    f.anello(rEsterno, R, 0, quota, -cfg.ampiezza - 0.3, cfg.ampiezza + 0.3, c.banco, LEGNO, c.gradino, TESSUTO);

    /* Gradinata del pubblico: parte dal parapetto e sale dentro la loggia. */
    const profondo = cfg.loggia + 1.3, fileTr = 5;
    for (let i = 0; i < fileTr; i++) {
      const r0 = R - 1.35 + profondo * i / fileTr, r1 = R - 1.35 + profondo * (i + 1) / fileTr;
      const y = cfg.tribuna + 0.05 + i * 0.34;
      f.anello(r0, r1, cfg.tribuna, y, -limite, limite, c.banco, LEGNO, c.gradino, TESSUTO);
      if (i < fileTr - 1) {
        f.anello(r1 - 0.42, r1 - 0.12, y, y + 0.44, -limite, limite, c.velluto, TESSUTO);
        f.anello(r1 - 0.14, r1 - 0.05, y, y + 0.92, -limite, limite, c.velluto, TESSUTO);
      }
    }

    const fz = cfg.fondo;
    f.scatola(-9.2, 9.2, 0, 0.3, fz - 2.9, fz - 0.4, c.banco, LEGNO);
    f.scatola(-8.8, 8.8, 0.3, 1.6, fz - 2.7, fz - 0.6, c.banco, LEGNO, c.muro, LEGNO);
    f.scatola(-9.0, 9.0, 1.6, 1.72, fz - 2.85, fz - 0.45, c.banco, LEGNO, c.muro, LEGNO);
    f.scatola(-1.8, 1.8, 1.72, 2.5, fz - 2.5, fz - 0.8, c.banco, LEGNO, c.muro, LEGNO);
    for (let i = -5; i <= 5; i++) {
      const a = i * 1.56;
      f.scatola(a - 0.62, a + 0.62, 0.48, 1.42, fz - 2.74, fz - 2.70, c.chiaro, LEGNO);
    }
    f.scatola(-7.2, 7.2, 0, 1.0, fz - 4.9, fz - 4.2, c.banco, LEGNO, c.piano, PELLE);
    f.scatola(-6.4, 6.4, 0, 0.92, fz - 6.5, fz - 5.8, c.banco, LEGNO, c.piano, PELLE);
    f.scatola(-2.2, 2.2, 0, 0.82, fz - 8.0, fz - 7.4, c.banco, LEGNO, c.piano, PELLE);
    for (let i = -6; i <= 6; i++) {
      f.scatola(i * 1.08 - 0.26, i * 1.08 + 0.26, 0, 1.15, fz - 4.0, fz - 3.75, cfg.sedile, TESSUTO);
      f.scatola(i * 0.98 - 0.25, i * 0.98 + 0.25, 0, 1.1, fz - 5.6, fz - 5.35, cfg.sedile, TESSUTO);
    }
    for (let i = -1; i <= 1; i += 2) {
      f.tronco(i * 0.9, fz - 1.6, 0.012, 0.012, 2.5, 2.8, c.bordo, OTTONE);
      f.scatola(i * 0.9 - 0.12, i * 0.9 + 0.12, 2.5, 2.6, fz - 2.1, fz - 1.9, bianco);
    }
    return f;
  }

  /* ---- il guscio: pareti modellate ---- */

  /* Alla Camera ogni campata è un arco vero: nicchia, tendaggi, porta. */
  function campataArco(f, cfg, t0, t1, y0, y1) {
    const R = cfg.rMuro + cfg.loggia, c = cfg.colori, m = (t0 + t1) / 2;
    const a = (t1 - t0) * 0.33, ra = a * R, ys = y0 + (y1 - y0) * 0.5, fondo = R + 0.8;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, tc = (ta + tb) / 2;
      const d = Math.abs(tc - m);
      if (d >= a) {
        f.cono(R, y0, R, y1, ta, tb, c.intonaco, 0);
        continue;
      }
      const h = (t) => ys + Math.sqrt(Math.max(ra * ra - Math.pow((t - m) * R, 2), 0));
      const ha = h(ta), hb = h(tb);
      f.quad(polare(R, ta, ha), polare(R, tb, hb), polare(R, tb, y1), polare(R, ta, y1), c.intonaco);
      f.quad(polare(R - 0.05, ta, ha - 0.02), polare(R - 0.05, tb, hb - 0.02), polare(R - 0.05, tb, hb + 0.24), polare(R - 0.05, ta, ha + 0.24), c.colonna, null, LEGNO);
      f.quad(polare(fondo, ta, ha), polare(fondo, tb, hb), polare(R, tb, hb), polare(R, ta, ha), c.colonna, null, LEGNO);
      f.quad(polare(fondo, ta, y0), polare(fondo, tb, y0), polare(fondo, tb, ys + 0.2), polare(fondo, ta, ys + 0.2), c.intonaco);
      f.quad(polare(fondo, ta, ys + 0.2), polare(fondo, tb, ys + 0.2), polare(fondo, tb, ha), polare(fondo, ta, ha), c.drappo, null, TESSUTO);
    }
    [[-a, -a * 0.55], [a * 0.55, a]].forEach(([p, q]) => {
      f.drappo(fondo - 0.1, ys - 1.0, ys + ra - 0.2, m + p, m + q, 4, c.drappo);
    });
    f.drappo(fondo - 0.25, ys + 0.4, ys + ra - 0.05, m - a * 0.9, m + a * 0.9, 9, c.drappo);
    [[-a, -a * 0.97], [a * 0.97, a]].forEach(([p, q]) => {
      f.quad(polare(R, m + q, y0), polare(fondo, m + q, y0), polare(fondo, m + q, ys), polare(R, m + q, ys), c.colonna, null, LEGNO);
      f.quad(polare(fondo, m + p, y0), polare(R, m + p, y0), polare(R, m + p, ys), polare(fondo, m + p, ys), c.colonna, null, LEGNO);
    });
    const [x, , z] = polare(fondo - 0.2, m, 0), lt = 0.8, dx = Math.cos(m) * lt, dz = Math.sin(m) * lt;
    const yp = y0 + 2.5;
    f.quad([x - dx, y0, z - dz], [x + dx, y0, z + dz], [x + dx, yp, z + dz], [x - dx, yp, z - dz], c.banco, null, LEGNO);
    f.quad([x - dx * 1.3, yp, z - dz * 1.3], [x + dx * 1.3, yp, z + dz * 1.3], [x, yp + 0.75, z], [x, yp + 0.75, z], c.colonna, null, LEGNO);
  }

  /* Al Senato pannelli intarsiati con filetti d'oro e finestrelle in alto. */
  function campataPannello(f, cfg, t0, t1, y0, y1) {
    const R = cfg.rMuro + cfg.loggia, c = cfg.colori;
    f.cono(R, y0, R, y1, t0, t1, c.muro, LEGNO);
    const m = (t1 - t0) * 0.14;
    const cornice = (r, a, b, h0, h1, spessore, col, tipo) => {
      f.cono(r, h0, r, h1, a, b, col, tipo);
      const ds = spessore / R;
      f.cono(r - 0.05, h0, r - 0.05, h0 + spessore, a, b, c.bordo, OTTONE);
      f.cono(r - 0.05, h1 - spessore, r - 0.05, h1, a, b, c.bordo, OTTONE);
      f.cono(r - 0.05, h0 + spessore, r - 0.05, h1 - spessore, a, a + ds, c.bordo, OTTONE);
      f.cono(r - 0.05, h0 + spessore, r - 0.05, h1 - spessore, b - ds, b, c.bordo, OTTONE);
    };
    const hA = y1 - 1.5;
    cornice(R - 0.1, t0 + m, t1 - m, y0 + 0.5, hA, 0.05, c.chiaro, LEGNO);
    cornice(R - 0.22, t0 + m * 1.9, t1 - m * 1.9, y0 + 1.0, hA - 0.5, 0.03, c.intarsio, LEGNO);
    const trip = (t1 - t0 - 2 * m) / 3;
    for (let k = 0; k < 3; k++) {
      cornice(R - 0.1, t0 + m + k * trip + 0.01, t0 + m + (k + 1) * trip - 0.01, hA + 0.25, y1 - 0.35, 0.03, c.intarsio, LEGNO);
    }
  }

  function costruisciMuri(cfg) {
    const c = cfg.colori, f = new Forma(), R = cfg.rMuro;
    const limite = Math.acos(-cfg.fondo / R);
    const passo = 2 * limite / cfg.campate;
    const quotaSu = cfg.file * cfg.alzata + 0.25;
    const camera = cfg === AULE.camera;
    const yT = cfg.tribuna + cfg.parapetto;
    const rA = R + cfg.loggia;

    f.cono(R, 0, R, cfg.tribuna, -limite, limite, c.muro, LEGNO);

    for (let i = 0; i < cfg.campate; i++) {
      const t0 = -limite + i * passo, t1 = t0 + passo, m = (t0 + t1) / 2;

      /* Piano basso: porte e tendoni rossi fra una lesena e l'altra. */
      if (camera && i % 3 !== 1) {
        f.drappo(R, quotaSu + 0.2, cfg.tribuna - 0.3, t0 + 0.03, t1 - 0.03, 9, c.velluto);
        f.cono(R - 0.22, cfg.tribuna - 0.3, R - 0.22, cfg.tribuna - 0.05, t0, t1, c.bordo, OTTONE);
      } else {
        const [x, , z] = polare(R - 0.14, m, 0), e = 0.95;
        const dx = Math.cos(m) * e, dz = Math.sin(m) * e;
        const h = cfg.tribuna - 0.5;
        f.quad([x - dx, quotaSu, z - dz], [x + dx, quotaSu, z + dz], [x + dx, h, z + dz], [x - dx, h, z - dz], c.colonna, null, LEGNO);
        f.quad([x + 0.02 * dx, quotaSu, z + 0.02 * dz], [x + dx * 0.8, quotaSu, z + dz * 0.8], [x + dx * 0.8, h - 0.2, z + dz * 0.8], [x + 0.02 * dx, h - 0.2, z + 0.02 * dz], c.chiaro, null, LEGNO);
        f.quad([x - dx * 0.8, quotaSu, z - dz * 0.8], [x - 0.02 * dx, quotaSu, z - 0.02 * dz], [x - 0.02 * dx, h - 0.2, z - 0.02 * dz], [x - dx * 0.8, h - 0.2, z - dz * 0.8], c.chiaro, null, LEGNO);
      }
      for (let k = -1; k <= 1; k += 2) {
        const [lx, , lz] = polare(R - 0.14, m + k * passo * 0.5, 0);
        f.tronco(lx, lz, 0.2, 0.2, quotaSu, cfg.tribuna - 0.1, c.banco, LEGNO, 6);
      }

      /* Lampade sotto la balconata. */
      for (let k = 0; k < 5; k++) {
        const th = t0 + passo * (k + 0.5) / 5;
        const [lx, , lz] = polare(R - 1.0, th, 0);
        f.tronco(lx, lz, 0.05, 0.08, cfg.tribuna - 0.18, cfg.tribuna - 0.05, c.lampada, LUCE);
      }

      /* Parapetto: pannelli, cornici e un medaglione a ogni pilastro. */
      const rP = R - 1.5;
      const y0p = cfg.tribuna + 0.12, y1p = cfg.tribuna + cfg.parapetto - 0.14;
      const lar = (t1 - t0) / 3;
      for (let k = 0; k < 3; k++) {
        const a = t0 + k * lar + 0.012, b = t0 + (k + 1) * lar - 0.012;
        f.cono(rP - 0.07, y0p, rP - 0.07, y1p, a, b, c.chiaro, LEGNO);
        f.cono(rP - 0.14, y0p + 0.1, rP - 0.14, y1p - 0.1, a + 0.008, b - 0.008, c.banco, LEGNO);
      }
      const [mx, , mz] = polare(rP - 0.1, t0, 0);
      f.tronco(mx, mz, 0.2, 0.1, cfg.tribuna + 0.25, cfg.tribuna + 0.65, c.capitello, camera ? LEGNO : OTTONE);

      if (camera) campataArco(f, cfg, t0, t1, yT, cfg.alto);
      else campataPannello(f, cfg, t0, t1, cfg.tribuna, cfg.alto);

      /* Applique sulla parete di fondo della loggia, fra una campata e l'altra. */
      const yL = cfg.tribuna + 3.0;
      [t0 + 0.02, t1 - 0.02].forEach((th) => {
        const [lx, , lz] = polare(rA - 0.12, th, 0);
        f.tronco(lx, lz, 0.05, 0.11, yL, yL + 0.3, c.lampada, LUCE);
      });
      const [bx, , bz] = polare(rA - 0.05, t0, 0);
      f.scatola(bx - 0.28, bx + 0.28, cfg.tribuna, cfg.alto, bz - 0.28, bz + 0.28, c.colonna, LEGNO);
    }

    /* Soffitto a cassettoni della loggia e pavimento della tribuna. */
    f.cono(rA + 0.1, cfg.alto, R - 0.4, cfg.alto, -limite, limite, c.colonna, LEGNO);
    for (let k = 1; k < 4; k++) {
      const r = R - 0.4 + (rA - R + 0.4) * k / 4;
      f.cono(r + 0.1, cfg.alto - 0.1, r - 0.1, cfg.alto - 0.1, -limite, limite, c.capitello, camera ? LEGNO : OTTONE);
    }
    const nCass = cfg.campate * 3;
    for (let i = 0; i <= nCass; i++) {
      const th = -limite + 2 * limite * i / nCass;
      f.quad(polare(rA, th + 0.008, cfg.alto - 0.1), polare(rA, th - 0.008, cfg.alto - 0.1), polare(R - 0.4, th - 0.008, cfg.alto - 0.1), polare(R - 0.4, th + 0.008, cfg.alto - 0.1), c.capitello, null, camera ? LEGNO : OTTONE);
    }

    f.anello(R - 1.55, R, cfg.tribuna - 0.05, cfg.tribuna + 0.1, -limite, limite, c.colonna, LEGNO);
    f.cono(R - 1.5, cfg.tribuna, R - 1.5, cfg.tribuna + cfg.parapetto, -limite, limite, c.banco, LEGNO);
    f.anello(R - 1.6, R - 1.42, cfg.tribuna + cfg.parapetto - 0.1, cfg.tribuna + cfg.parapetto, -limite, limite, c.chiaro, LEGNO, c.colonna, LEGNO);
    return f;
  }

  function costruisciColonne(cfg) {
    const c = cfg.colori, f = new Forma(), R = cfg.rMuro;
    const limite = Math.acos(-cfg.fondo / R);
    const passo = 2 * limite / cfg.campate;
    const camera = cfg === AULE.camera;
    const y0 = cfg.tribuna + cfg.parapetto * 0.2, y1 = cfg.alto;
    const tipoCap = camera ? LEGNO : OTTONE;
    for (let i = 0; i <= cfg.campate; i++) {
      const th = -limite + i * passo;
      (camera ? [-0.034, 0.034] : [0]).forEach((d) => {
        const [x, , z] = polare(R - 0.3, th + d, 0);
        const r = camera ? 0.36 : 0.44;
        f.tronco(x, z, r * 1.5, r * 1.4, y0, y0 + 0.28, c.capitello, tipoCap);
        f.tronco(x, z, r * 1.25, r * 1.2, y0 + 0.28, y0 + 0.4, c.capitello, tipoCap);
        f.tronco(x, z, r * 1.1, r * 0.96, y0 + 0.4, y1 - 0.8, c.colonna, LEGNO, 10);
        f.tronco(x, z, r * 1.02, r * 1.02, y1 - 0.8, y1 - 0.72, c.capitello, tipoCap);
        f.tronco(x, z, r * 1.0, r * 1.45, y1 - 0.72, y1 - 0.24, c.capitello, tipoCap, 7);
        f.tronco(x, z, r * 1.55, r * 1.55, y1 - 0.24, y1, c.capitello, tipoCap);
      });
    }
    return f;
  }

  /* Cornicione con dentelli e mensole, poi la volta. */
  function costruisciCornice(cfg) {
    const c = cfg.colori, f = new Forma(), R = cfg.rMuro;
    const limite = Math.acos(-cfg.fondo / R);
    const al = cfg.alto, camera = cfg === AULE.camera;
    const passi = camera ? 110 : 90;
    const legno = camera ? c.colonna : c.muro, dente = camera ? c.capitello : c.bordo;
    f.anello(R - 0.4, R, al, al + 0.16, -limite, limite, legno, LEGNO);
    f.anello(R - 0.52, R, al + 0.16, al + 0.26, -limite, limite, c.banco, LEGNO, dente, camera ? LEGNO : OTTONE);
    for (let i = 0; i < passi; i++) {
      const th = -limite + 2 * limite * (i + 0.5) / passi;
      const [x, , z] = polare(R - 0.56, th, 0);
      f.scatola(x - 0.08, x + 0.08, al + 0.26, al + 0.4, z - 0.08, z + 0.08, dente, camera ? LEGNO : OTTONE);
    }
    f.anello(R - 0.72, R, al + 0.4, al + cfg.cornice, -limite, limite, legno, LEGNO);
    const bloc = cfg.campate;
    for (let i = 0; i <= bloc; i++) {
      const [x, , z] = polare(R - 0.7, -limite + 2 * limite * i / bloc, 0);
      f.scatola(x - 0.2, x + 0.2, al + 0.05, al + cfg.cornice, z - 0.2, z + 0.2, dente, camera ? LEGNO : OTTONE);
    }

    const yC = al + cfg.cornice;
    if (camera) {
      const yF = yC + 2.4, yV = yF + 2.2, rV = R - 4.6;
      f.anello(R - 1.75, R - 1.4, yF - 0.06, yF + 0.12, -limite, limite, c.colonna, LEGNO);
      f.cono(R - 1.6, yF, rV, yV, -limite, limite, c.colonna, LEGNO);
      const finestre = 9;
      for (let i = 0; i < finestre; i++) {
        const m = -limite + 2 * limite * (i + 0.5) / finestre, a = 0.13;
        const p = (r, t, y) => polare(r - 0.1, t, y);
        const r0 = R - 2.0, r1 = R - 2.8, y0 = yF + 0.3, y1 = yF + 1.1;
        f.quad(p(r0, m - a, y0), p(r0, m + a, y0), p(r1, m + a, y1), p(r1, m - a, y1), c.vetro, null, LUCE);
        [-1 / 3, 1 / 3].forEach((k) => {
          const t = m + k * a * 2;
          f.quad(p(r0 + 0.04, t - 0.006, y0), p(r0 + 0.04, t + 0.006, y0), p(r1 + 0.04, t + 0.006, y1), p(r1 + 0.04, t - 0.006, y1), c.capitello, null, LEGNO);
        });
      }
      f.cono(rV, yV, 0.1, yV + 0.4, -limite, limite, c.vetro, LUCE);
      for (let i = 0; i < 18; i++) {
        const t = -limite + 2 * limite * i / 17;
        f.quad(polare(rV, t - 0.012, yV - 0.02), polare(rV, t + 0.012, yV - 0.02), polare(0.2, t + 0.2, yV + 0.36), polare(0.2, t - 0.2, yV + 0.36), c.colonna, null, LEGNO);
      }
      [0.33, 0.66].forEach((k) => {
        const r = rV * k, y = yV + 0.4 * (1 - k) - 0.03;
        f.cono(r + 0.14, y, r - 0.14, y + 0.03, -limite, limite, c.colonna, LEGNO);
      });
    } else {
      f.anello(R - 2.4, R - 2.0, yC + 1.5, yC + 1.65, -limite, limite, c.capitello, OTTONE);
    }
    return f;
  }

  /* L'altorilievo dietro la presidenza: una superficie in rilievo, non una foto. */
  function costruisciRilievo(cfg) {
    const f = new Forma(), z = cfg.fondo - 0.05;
    const y0 = 2.2, y1 = cfg.tribuna + 0.05, x0 = -9.6, x1 = 9.6;
    const bronzo = [0.27, 0.21, 0.14];
    const pesi = [];
    let s = 7;
    const caso = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    [[0.5, 0.35, 0.075, 0.55, 0.34], [0.46, 0.3, 0.05, 0.4, 0.24], [0.54, 0.3, 0.05, 0.4, 0.24]].forEach((b) => pesi.push(b));
    [0.17, 0.83].forEach((c) => {
      for (let i = 0; i < 9; i++) {
        pesi.push([c + (caso() - 0.5) * 0.28, 0.25 + caso() * 0.45, 0.03 + caso() * 0.04, 0.05 + caso() * 0.11, 0.26 + caso() * 0.2]);
      }
    });
    const quota = (u, v) => {
      let h = 0.02 * Math.sin(u * 120) * Math.sin(v * 40);
      pesi.forEach(([a, b, l, m, peso]) => {
        const d = Math.pow((u - a) / l, 2) + Math.pow((v - b) / m, 2);
        h += peso * Math.exp(-d);
      });
      return Math.min(h, 0.55);
    };
    const nx = 150, ny = 44;
    const p = (i, j) => {
      const u = i / nx, v = j / ny;
      return [x1 + (x0 - x1) * u, y0 + (y1 - y0) * v, z - quota(u, v)];
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      f.quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), bronzo, null, OTTONE);
    }
    return f;
  }

  function costruisciBandiere(cfg) {
    const f = new Forma(), R = 9.4, y0 = 1.72, y1 = 4.6, z = cfg.fondo - 1.2;
    const tela = (x, colori) => {
      f.tronco(x, z, 0.03, 0.03, 0, y1 + 0.3, cfg.colori.bordo, OTTONE);
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n;
        const col = colori[Math.floor(a * colori.length)];
        const zz = (t) => z + 0.14 * Math.sin(t * 14);
        const xx = (t) => x + 0.7 * t * Math.sign(-x);
        f.quad([xx(b), y0 + 0.4 * b, zz(b)], [xx(a), y0 + 0.4 * a, zz(a)], [xx(a), y1, zz(a)], [xx(b), y1, zz(b)], col, null, TESSUTO);
        f.quad([xx(a), y0 + 0.4 * a, zz(a)], [xx(b), y0 + 0.4 * b, zz(b)], [xx(b), y1, zz(b)], [xx(a), y1, zz(a)], col, null, TESSUTO);
      }
    };
    const tricolore = [[0.0, 0.42, 0.22], [0.92, 0.92, 0.9], [0.8, 0.13, 0.15]];
    tela(-R, tricolore);
    tela(R, [[0.0, 0.2, 0.55]]);

    /* Due tricolori sulla balconata di fronte alla presidenza, come nelle sedute solenni. */
    [-0.48, 0.48].forEach((th) => {
      const [bx, , bz] = polare(cfg.rMuro - 1.2, th, 0);
      const y0Asta = cfg.tribuna + cfg.parapetto, alto = y0Asta + 3.5, largo = 1.15;
      f.tronco(bx, bz, 0.035, 0.03, cfg.tribuna, alto, cfg.colori.bordo, OTTONE);
      f.tronco(bx, bz, 0.07, 0.0, alto, alto + 0.28, cfg.colori.bordo, OTTONE);
      const tx = Math.cos(th), tz = Math.sin(th);
      const nx = -Math.sin(th), nz = Math.cos(th);
      const punto = (u, y) => {
        const onda = 0.13 * Math.sin(u * 15) * (0.4 + u);
        return [bx + tx * u * largo + nx * onda, y - 0.42 * u, bz + tz * u * largo + nz * onda];
      };
      const n = 21, testa = alto - 0.1, piede = alto - 2.9;
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n, col = tricolore[Math.floor(a * 3)];
        f.quad(punto(a, piede), punto(b, piede), punto(b, testa), punto(a, testa), col, null, TESSUTO);
        f.quad(punto(b, piede), punto(a, piede), punto(a, testa), punto(b, testa), col, null, TESSUTO);
      }
    });
    return f;
  }

  function fascia(cfg, r0, y0, r1, y1, ripeti) {
    const f = new Forma();
    const limite = Math.acos(-cfg.fondo / cfg.rMuro);
    f.cono(r0, y0, r1, y1, -limite, limite, [1, 1, 1], 0, ripeti);
    return f;
  }

  /* I dipinti sono disegnati, non fotografati. */
  function dipingiFregio() {
    const tela = document.createElement('canvas');
    tela.width = 2048;
    tela.height = 256;
    const g = tela.getContext('2d');
    const sfondo = g.createLinearGradient(0, 0, 0, 256);
    sfondo.addColorStop(0, '#c9c6a2');
    sfondo.addColorStop(0.6, '#a9b08a');
    sfondo.addColorStop(1, '#8f9a76');
    g.fillStyle = sfondo;
    g.fillRect(0, 0, 2048, 256);
    let s = 11;
    const caso = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const toni = ['#7c8a66', '#667a5c', '#cfc49c', '#b39a68', '#e2d8b8', '#8f9264', '#5b7058'];
    g.filter = 'blur(5px)';
    for (let i = 0; i < 40; i++) {
      g.fillStyle = toni[Math.floor(caso() * toni.length)];
      g.globalAlpha = 0.45;
      g.beginPath();
      g.ellipse(caso() * 2048, 150 + caso() * 110, 50 + caso() * 110, 26 + caso() * 40, caso() * 0.6 - 0.3, 0, Math.PI * 2);
      g.fill();
    }
    /* Corpi e panneggi resi a pennellate larghe, come un fregio visto da lontano. */
    g.filter = 'blur(2px)';
    g.globalAlpha = 0.85;
    for (let i = 0; i < 70; i++) {
      const x = i / 70 * 2048 + caso() * 20, base = 230 + caso() * 20, h = 110 + caso() * 70;
      const pende = (caso() - 0.5) * 60, largo = 16 + caso() * 16;
      g.fillStyle = toni[Math.floor(caso() * toni.length)];
      g.beginPath();
      g.moveTo(x - largo, base);
      g.bezierCurveTo(x - largo * 0.8 + pende * 0.2, base - h * 0.5, x - largo * 0.3 + pende * 0.7, base - h * 0.8, x + pende, base - h);
      g.bezierCurveTo(x + largo * 0.5 + pende * 0.7, base - h * 0.8, x + largo + pende * 0.2, base - h * 0.5, x + largo, base);
      g.closePath();
      g.fill();
      g.fillStyle = '#d9b98c';
      g.beginPath();
      g.ellipse(x + pende * 1.03, base - h - 9, 7, 9, pende * 0.01, 0, Math.PI * 2);
      g.fill();
    }
    g.filter = 'none';
    g.globalAlpha = 1;
    return tela;
  }

  function dipingiSoffitto() {
    const tela = document.createElement('canvas');
    tela.width = 1024;
    tela.height = 128;
    const g = tela.getContext('2d');
    g.fillStyle = '#7d1f24';
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#3f5a44';
    g.fillRect(0, 0, 1024, 22);
    g.strokeStyle = '#c9a24e';
    g.lineWidth = 5;
    for (let x = 0; x < 1024; x += 128) {
      g.fillStyle = '#b89a6a';
      g.beginPath();
      g.moveTo(x, 22);
      g.quadraticCurveTo(x + 64, 118, x + 128, 22);
      g.quadraticCurveTo(x + 64, 66, x, 22);
      g.fill();
      g.stroke();
    }
    g.fillStyle = '#c9a24e';
    g.fillRect(0, 120, 1024, 8);
    return tela;
  }

  function pezziGuscio(cfg) {
    const R = cfg.rMuro, yC = cfg.alto + cfg.cornice;
    if (cfg === AULE.camera) {
      return [{ forma: fascia(cfg, R - 0.6, yC, R - 1.6, yC + 2.4, 2), tex: 'fregio' }];
    }
    return [{ forma: fascia(cfg, R - 0.7, yC, R - 2.2, yC + 1.5, 10), tex: 'soffitto' }];
  }

  /* ---- poltrona e dotazioni del singolo seggio ---- */

  function costruisciPoltrona() {
    const f = new Forma();
    const u = [1, 1, 1], legno = [0.30, 0.17, 0.09], metallo = [0.16, 0.16, 0.16];
    f.scatola(-0.30, 0.30, 0.42, 0.56, -0.26, 0.26, u, PELLE);
    const lati = 7;
    for (let i = 0; i < lati; i++) {
      const xa = -0.31 + 0.62 * i / lati, xb = -0.31 + 0.62 * (i + 1) / lati;
      const z = (x) => 0.21 + 0.34 * x * x;
      const alto = (x) => 1.14 - 0.5 * x * x;
      const [ya, yb] = [alto(xa), alto(xb)];
      f.quad([xb, 0.5, z(xb)], [xa, 0.5, z(xa)], [xa, ya, z(xa) + 0.05], [xb, yb, z(xb) + 0.05], u, null, PELLE);
      f.quad([xa, 0.5, z(xa) + 0.1], [xb, 0.5, z(xb) + 0.1], [xb, yb, z(xb) + 0.12], [xa, ya, z(xa) + 0.12], u, null, PELLE);
      f.quad([xa, ya, z(xa) + 0.05], [xa, ya, z(xa) + 0.12], [xb, yb, z(xb) + 0.12], [xb, yb, z(xb) + 0.05], u, null, PELLE);
    }
    [-1, 1].forEach((s) => {
      f.scatola(s * 0.32 - 0.03, s * 0.32 + 0.03, 0.72, 0.76, -0.2, 0.24, legno, LEGNO);
      f.scatola(s * 0.32 - 0.015, s * 0.32 + 0.015, 0.54, 0.72, -0.14, -0.1, metallo, OTTONE);
    });
    f.tronco(0, 0, 0.05, 0.04, 0, 0.42, metallo, OTTONE);
    f.tronco(0, 0, 0.24, 0.05, 0, 0.05, metallo, OTTONE);
    return f;
  }

  function costruisciDotazioni(cfg) {
    const c = cfg.colori, f = new Forma();
    const nero = [0.05, 0.05, 0.05], carta = [0.88, 0.86, 0.80];
    f.scatola(-0.32, -0.30, 0, 0.72, -0.74, -0.70, c.chiaro, LEGNO);
    f.scatola(0.30, 0.32, 0, 0.72, -0.74, -0.70, c.chiaro, LEGNO);
    f.quad([0.008, 0.78, -0.56], [-0.008, 0.78, -0.56], [-0.008, 1.03, -0.42], [0.008, 1.03, -0.42], nero, null, OTTONE);
    f.quad([-0.008, 0.78, -0.56], [0.008, 0.78, -0.56], [0.008, 1.03, -0.42], [-0.008, 1.03, -0.42], nero, null, OTTONE);
    f.scatola(-0.018, 0.018, 1.02, 1.06, -0.45, -0.39, nero);
    f.scatola(-0.14, 0.14, 0.78, 0.785, -0.52, -0.34, carta);
    return f;
  }

  /* Lo stemma sta sullo schienale, verso chi guarda dalla presidenza. */
  function costruisciStemma() {
    const f = new Forma(), l = 0.2, y = 0.86, z = 0.195;
    f.quad([l, y - l, z], [-l, y - l, z], [-l, y + l, z], [l, y + l, z], [1, 1, 1], [[0, 1], [1, 1], [1, 0], [0, 0]]);
    return f;
  }

  /* ---- matrici ---- */

  function prospettiva(fov, asp, vicino, lontano) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (vicino - lontano);
    return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (lontano + vicino) * nf, -1, 0, 0, 2 * lontano * vicino * nf, 0];
  }

  function ortogonale(a, v, l) {
    return [1 / a, 0, 0, 0, 0, 1 / a, 0, 0, 0, 0, -2 / (l - v), 0, 0, 0, -(l + v) / (l - v), 1];
  }

  function guarda(o, t) {
    let z = [o[0] - t[0], o[1] - t[1], o[2] - t[2]];
    let l = Math.hypot(...z); z = z.map((v) => v / l);
    let x = [z[2], 0, -z[0]];
    l = Math.hypot(...x); x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const d = (a) => -(a[0] * o[0] + a[1] * o[1] + a[2] * o[2]);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, d(x), d(y), d(z), 1];
  }

  function moltiplica(a, b) {
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
    return m;
  }

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);

  /* ---- scena ---- */

  function programma(gl, fs) {
    const prog = gl.createProgram();
    [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(([tipo, src]) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(prog, s);
    });
    gl.linkProgram(prog);
    return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
  }

  function crea(canvas, opzioni) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) return null;
    const prog = programma(gl, FS), progOmbra = programma(gl, FS_OMBRA);
    if (!prog || !progOmbra) return null;

    const u = {}, uo = {};
    ['vp', 'lvp', 'istanza', 'usaTex', 'tex', 'ombraTex', 'occhio', 'stemma', 'loggia'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });
    ['vp', 'istanza'].forEach((n) => { uo[n] = gl.getUniformLocation(progOmbra, n); });
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0.03, 0.03, 0.03, 1);

    const LATO = 2048;
    const ombraTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ombraTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, LATO, LATO);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, ombraTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const luceVP = moltiplica(ortogonale(26, 4, 80), guarda([8.8, 40, 7.2], [0, 0, -3]));

    const vuota = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, vuota);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

    const texCache = {};
    function textura(nome) {
      if (texCache[nome]) return texCache[nome];
      const t = gl.createTexture();
      texCache[nome] = t;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nome === 'fregio' ? dipingiFregio() : dipingiSoffitto());
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const an = gl.getExtension('EXT_texture_filter_anisotropic');
      if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      return t;
    }

    function carica(forma) {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(forma.dati), gl.STATIC_DRAW);
      [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 2, 36], [4, 1, 44]].forEach(([l, n, o]) => {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, n, gl.FLOAT, false, 48, o);
      });
      return { vao, buf, conta: forma.dati.length / 12 };
    }

    function agganciaIstanze(pezzo) {
      gl.bindVertexArray(pezzo.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, istanze);
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 36, 0);
      gl.vertexAttribDivisor(5, 1);
      gl.enableVertexAttribArray(6);
      gl.vertexAttribPointer(6, 3, gl.FLOAT, false, 36, 16);
      gl.vertexAttribDivisor(6, 1);
      gl.enableVertexAttribArray(7);
      gl.vertexAttribPointer(7, 2, gl.FLOAT, false, 36, 28);
      gl.vertexAttribDivisor(7, 1);
    }

    let pezzi = [], ombrosi = [];
    let poltrona = null, dotazioni = null, decalco = null, istanze = null;
    let posti = [], cfg = null, gruppi = [], attivo = null;
    const vista = { az: Math.PI, el: 0.23, azT: Math.PI, elT: 0.23, luce: 0, zoom: 1, zoomT: 1, fuoco: [0, 2.5, -10] };
    let matrice = null, occhio = [0, 0, 0], attesa = false, ombreVecchie = true;

    function imposta(nomeAula, nuoviGruppi, totale) {
      [...pezzi, dotazioni].forEach((p) => {
        if (p) { gl.deleteBuffer(p.buf); gl.deleteVertexArray(p.vao); }
      });
      cfg = AULE[nomeAula];
      gruppi = nuoviGruppi;
      attivo = null;
      vista.luce = 0;
      vista.az = vista.azT = Math.PI;
      vista.el = vista.elT = cfg.vista.el;
      vista.zoom = vista.zoomT = 1;
      vista.fuoco = [0, 2.5, -(cfg.rInt + cfg.file * cfg.passo * 0.5)];

      const interno = carica(costruisciInterno(cfg));
      const muri = carica(costruisciMuri(cfg));
      const colonne = carica(costruisciColonne(cfg));
      const cornice = carica(costruisciCornice(cfg));
      const bandiere = carica(costruisciBandiere(cfg));
      ombrosi = [interno];
      pezzi = [interno, muri, colonne, cornice, bandiere];
      if (cfg === AULE.camera) pezzi.push(carica(costruisciRilievo(cfg)));
      pezziGuscio(cfg).forEach(({ forma, tex }) => pezzi.push({ ...carica(forma), tex }));

      posti = seggi(cfg, totale);
      let cur = 0;
      gruppi.forEach((g) => {
        const col = hex(g.colore);
        const cella = (opzioni.stemmi || []).indexOf(g.stemma);
        for (let n = 0; n < g.seggi; n++, cur++) {
          posti[cur].gruppo = g.id;
          posti[cur].colore = col;
          posti[cur].cella = cella;
        }
      });
      for (; cur < posti.length; cur++) {
        posti[cur].gruppo = null;
        posti[cur].cella = -1;
        posti[cur].colore = cfg.sedile.map((v) => v * 0.3);
      }

      if (!istanze) istanze = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, istanze);
      gl.bufferData(gl.ARRAY_BUFFER, posti.length * 36, gl.DYNAMIC_DRAW);
      if (!poltrona) poltrona = carica(costruisciPoltrona());
      dotazioni = carica(costruisciDotazioni(cfg));
      if (!decalco) decalco = carica(costruisciStemma());
      agganciaIstanze(poltrona);
      agganciaIstanze(dotazioni);
      agganciaIstanze(decalco);
      scriviPosti();
      ombreVecchie = true;
      segna();
    }

    function scriviPosti() {
      const d = new Float32Array(posti.length * 9);
      const spegni = vista.luce, sedile = cfg.sedile;
      posti.forEach((p, i) => {
        const su = p.gruppo === attivo && attivo !== null;
        const [x, , z] = polare(p.r, p.th, 0);
        d.set([x, p.y, z, Math.PI - p.th], i * 9);
        p.x = x;
        p.z = z;
        const m = su ? 0 : spegni * 0.86;
        const chiaro = su ? 1 + 0.5 * spegni : 1;
        for (let k = 0; k < 3; k++) d[i * 9 + 4 + k] = (p.colore[k] * (1 - m) + sedile[k] * 0.45 * m) * chiaro;
        d[i * 9 + 7] = p.cella;
        d[i * 9 + 8] = su ? 1 : 1 - 0.72 * spegni;
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, istanze);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    }

    function misura() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        segna();
      }
    }

    function disegnaOmbre() {
      ombreVecchie = false;
      gl.useProgram(progOmbra);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, LATO, LATO);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uo.vp, false, luceVP);
      gl.uniform1f(uo.istanza, 0);
      ombrosi.forEach((p) => {
        gl.bindVertexArray(p.vao);
        gl.drawArrays(gl.TRIANGLES, 0, p.conta);
      });
      gl.uniform1f(uo.istanza, 1);
      gl.bindVertexArray(poltrona.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, poltrona.conta, posti.length);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog);
    }

    function disegna() {
      attesa = false;
      if (!cfg) return;
      let ancora = false;
      vista.az += (vista.azT - vista.az) * 0.16;
      vista.el += (vista.elT - vista.el) * 0.16;
      vista.zoom += (vista.zoomT - vista.zoom) * 0.16;
      if (Math.abs(vista.azT - vista.az) + Math.abs(vista.elT - vista.el) + Math.abs(vista.zoomT - vista.zoom) > 0.0005) ancora = true;

      const bersaglio = attivo ? 1 : 0;
      if (Math.abs(vista.luce - bersaglio) > 0.01) {
        vista.luce += (bersaglio - vista.luce) * 0.22;
        scriviPosti();
        ancora = true;
      } else if (vista.luce !== bersaglio) {
        vista.luce = bersaglio;
        scriviPosti();
      }
      if (ombreVecchie) disegnaOmbre();

      const asp = canvas.width / canvas.height;
      const dist = cfg.vista.dist * Math.max(1, 1.6 / asp) / vista.zoom;
      const peso = 1 - 1 / vista.zoom;
      const t = cfg.vista.t.map((v, i) => v + (vista.fuoco[i] - v) * peso);
      occhio = [
        t[0] + dist * Math.sin(vista.az) * Math.cos(vista.el),
        t[1] + dist * Math.sin(vista.el),
        t[2] - dist * Math.cos(vista.az) * Math.cos(vista.el)
      ];
      matrice = moltiplica(prospettiva(0.9, asp, Math.max(0.6, dist * 0.2), 90), guarda(occhio, t));

      gl.useProgram(prog);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(u.vp, false, matrice);
      gl.uniformMatrix4fv(u.lvp, false, luceVP);
      gl.uniform3fv(u.occhio, occhio);
      gl.uniform2f(u.loggia, cfg.rMuro - 0.5, cfg.rMuro + cfg.loggia);
      gl.uniform1i(u.tex, 0);
      gl.uniform1i(u.ombraTex, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ombraTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(u.istanza, 0);
      pezzi.forEach((p) => {
        gl.uniform1f(u.usaTex, p.tex ? 1 : 0);
        gl.bindTexture(gl.TEXTURE_2D, p.tex ? textura(p.tex) : vuota);
        gl.bindVertexArray(p.vao);
        gl.drawArrays(gl.TRIANGLES, 0, p.conta);
      });
      gl.uniform1f(u.usaTex, 0);
      gl.uniform1f(u.istanza, 1);
      gl.bindTexture(gl.TEXTURE_2D, vuota);
      gl.bindVertexArray(poltrona.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, poltrona.conta, posti.length);
      gl.bindVertexArray(dotazioni.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, dotazioni.conta, posti.length);
      if (atlante) {
        gl.uniform1f(u.stemma, 1);
        gl.bindTexture(gl.TEXTURE_2D, atlante);
        gl.bindVertexArray(decalco.vao);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-2, -2);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, decalco.conta, posti.length);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.uniform1f(u.stemma, 0);
      }
      if (ancora) segna();
    }

    /* Gli stemmi stanno in un'unica immagine da 4 per 4 caselle. */
    let atlante = null;
    function caricaStemmi() {
      const lista = opzioni.stemmi || [];
      const tela = document.createElement('canvas');
      tela.width = tela.height = 1024;
      const g = tela.getContext('2d');
      let mancano = lista.length;
      lista.forEach((url, i) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          if (img.naturalWidth) g.drawImage(img, (i % 4) * 256 + 8, Math.floor(i / 4) * 256 + 8, 240, 240);
          if (--mancano) return;
          atlante = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, atlante);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tela);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          const an = gl.getExtension('EXT_texture_filter_anisotropic');
          if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
          segna();
        };
        img.src = url;
      });
    }
    caricaStemmi();

    function ingrandisci(fattore, seggio) {
      const prima = vista.zoomT;
      vista.zoomT = Math.max(1, Math.min(8, prima * fattore));
      if (seggio && prima < 1.15) vista.fuoco = [seggio.x, seggio.y + 0.8, seggio.z];
      segna();
    }

    function segna() {
      if (attesa) return;
      attesa = true;
      requestAnimationFrame(disegna);
    }

    /* Il seggio sotto il puntatore: il più vicino sullo schermo. */
    function seggioIn(px, py) {
      if (!matrice) return null;
      const r = canvas.getBoundingClientRect();
      const m = matrice;
      let meglio = null, dMin = Math.pow(Math.max(14, r.width / 60), 2);
      posti.forEach((p) => {
        const x = p.x, y = p.y + 0.85, z = p.z;
        const w = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (w <= 0) return;
        const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * r.width;
        const sy = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * r.height;
        const d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
        if (d < dMin) { dMin = d; meglio = p; }
      });
      return meglio;
    }

    let trascina = null;
    const dita = new Map();
    let pinza = null;
    const distanzaDita = () => {
      const [a, b] = [...dita.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    canvas.addEventListener('pointerdown', (e) => {
      dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dita.size === 2) {
        pinza = distanzaDita();
        trascina = null;
        return;
      }
      trascina = { x: e.clientX, y: e.clientY, az: vista.azT, el: vista.elT, f: vista.fuoco.slice(), mosso: false };
      if (e.pointerType === 'mouse') canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      ingrandisci(Math.exp(-e.deltaY * 0.0016), seggioIn(e.clientX - r.left, e.clientY - r.top));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => {
      vista.zoomT = 1;
      segna();
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (dita.has(e.pointerId)) dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinza && dita.size === 2) {
        const d = distanzaDita();
        ingrandisci(d / pinza);
        pinza = d;
        return;
      }
      if (trascina) {
        const dx = e.clientX - trascina.x, dy = e.clientY - trascina.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) trascina.mosso = true;
        if (vista.zoomT > 1.3) {
          /* Da vicino il trascinamento sposta la vista, non la ruota. */
          const k = 0.045 / vista.zoom;
          vista.fuoco[0] = Math.max(-20, Math.min(20, trascina.f[0] - dx * k));
          vista.fuoco[2] = Math.max(-20, Math.min(4, trascina.f[2] - dy * k));
          vista.fuoco[1] = Math.max(0.6, Math.min(5, trascina.f[1] + dy * k * 0.3));
        } else {
          vista.azT = Math.max(Math.PI - 0.32, Math.min(Math.PI + 0.32, trascina.az - dx * 0.004));
          vista.elT = Math.max(0.14, Math.min(0.5, trascina.el + dy * 0.003));
        }
        segna();
        return;
      }
      if (e.pointerType !== 'mouse') return;
      const p = seggioIn(e.clientX - r.left, e.clientY - r.top);
      canvas.style.cursor = p && p.gruppo ? 'pointer' : 'grab';
      opzioni.quandoSopra(p ? p.gruppo : null, e.clientX - r.left, e.clientY - r.top);
    });
    canvas.addEventListener('pointerleave', () => opzioni.quandoSopra(null));
    canvas.addEventListener('pointercancel', (e) => {
      dita.delete(e.pointerId);
      pinza = null;
      trascina = null;
    });
    canvas.addEventListener('pointerup', (e) => {
      dita.delete(e.pointerId);
      if (pinza) {
        pinza = null;
        return;
      }
      const era = trascina;
      trascina = null;
      if (!era || era.mosso) return;
      const r = canvas.getBoundingClientRect();
      const p = seggioIn(e.clientX - r.left, e.clientY - r.top);
      if (p && p.gruppo) opzioni.quandoScegli(p.gruppo);
    });

    new ResizeObserver(misura).observe(canvas);
    misura();

    return {
      imposta,
      ingrandisci,
      seleziona(id) {
        if (attivo === id) return;
        attivo = id;
        scriviPosti();
        segna();
      }
    };
  }

  return { disponibile, crea };
})();
