/* ============================================
   NEUTRALIA — Osservatorio: modellini 3D illustrativi (WebGL2, senza librerie)
   Ogni tipo di luogo ha il suo modellino. Non sono in scala.
   ============================================ */

window.OsvModelli = (function () {
  const VS = `#version 300 es
  layout(location=0) in vec3 p;
  layout(location=1) in vec3 n;
  layout(location=2) in vec3 c;
  uniform mat4 vp;
  out vec3 vn, vc;
  void main() { vn = n; vc = c; gl_Position = vp * vec4(p, 1.0); }`;

  const FS = `#version 300 es
  precision highp float;
  in vec3 vn, vc;
  out vec4 o;
  void main() {
    vec3 N = normalize(vn);
    float d = max(dot(N, normalize(vec3(0.5, 0.9, 0.4))), 0.0);
    float f = max(dot(N, normalize(vec3(-0.6, 0.3, -0.5))), 0.0) * 0.28;
    vec3 c = pow(vc, vec3(2.2)) * (0.34 + 0.25 * (N.y * 0.5 + 0.5) + d * 1.05 + f);
    c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
    o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
  }`;

  /* ---- forme ---- */

  function Forma() { this.d = []; }

  Forma.prototype.tri = function (a, b, c, col) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1;
    [a, b, c].forEach((p) => this.d.push(...p, n[0] / l, n[1] / l, n[2] / l, ...col));
  };

  Forma.prototype.quad = function (a, b, c, d, col) {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  };

  /* Scatola centrata in (x, z), appoggiata a quota y, ruotabile attorno a y. */
  Forma.prototype.box = function (x, y, z, w, h, d, col, rot) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const P = (a, q, b) => [x + a * c + b * s, q, z - a * s + b * c];
    const W = w / 2, D = d / 2, T = y + h;
    const A = P(-W, y, -D), B = P(W, y, -D), C = P(W, y, D), E = P(-W, y, D);
    const F = P(-W, T, -D), G = P(W, T, -D), H = P(W, T, D), I = P(-W, T, D);
    this.quad(I, H, G, F, col);
    this.quad(B, A, F, G, col);
    this.quad(E, C, H, I, col);
    this.quad(A, E, I, F, col);
    this.quad(C, B, G, H, col);
    return this;
  };

  /* Solido di rivoluzione verticale: profilo di coppie [raggio, quota]. */
  Forma.prototype.giro = function (x, y, z, profilo, col, lati) {
    const n = lati || 18;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
      for (let k = 0; k < profilo.length - 1; k++) {
        const [r0, h0] = profilo[k], [r1, h1] = profilo[k + 1];
        const P = (r, h, t) => [x + r * Math.sin(t), y + h, z + r * Math.cos(t)];
        this.quad(P(r0, h0, a), P(r0, h0, b), P(r1, h1, b), P(r1, h1, a), col);
      }
    }
    return this;
  };

  Forma.prototype.cil = function (x, y, z, r, h, col) {
    return this.giro(x, y, z, [[0, 0], [r, 0], [r, h], [0, h]], col, 14);
  };

  /* Cilindro disteso lungo l'asse x: fusoliere, scafi tondi, tubi. */
  Forma.prototype.tubo = function (x0, x1, y, z, r, col, r1) {
    const n = 12, rb = r1 === undefined ? r : r1;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
      const P = (X, R, t) => [X, y + R * Math.cos(t), z + R * Math.sin(t)];
      this.quad(P(x0, r, a), P(x0, r, b), P(x1, rb, b), P(x1, rb, a), col);
    }
    return this;
  };

  /* Prisma: pianta poligonale estrusa in altezza, per ali, scafi, tetti. */
  Forma.prototype.prisma = function (punti, y, h, col) {
    const n = punti.length;
    for (let i = 1; i < n - 1; i++) {
      const a = punti[0], b = punti[i + 1], c = punti[i];
      this.tri([a[0], y + h, a[1]], [b[0], y + h, b[1]], [c[0], y + h, c[1]], col);
    }
    for (let i = 0; i < n; i++) {
      const a = punti[i], b = punti[(i + 1) % n];
      this.quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]], col);
    }
    return this;
  };

  /* Volta semicilindrica: hangar e rifugi per aerei. */
  Forma.prototype.volta = function (x, y, z, r, l, col) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI, b = (i + 1) / n * Math.PI;
      const P = (t, q) => [x + r * Math.cos(t), y + r * Math.sin(t), z + q];
      this.quad(P(b, l / 2), P(a, l / 2), P(a, -l / 2), P(b, -l / 2), col);
      this.tri([x, y, z + l / 2], P(a, l / 2), P(b, l / 2), col);
      this.tri([x, y, z - l / 2], P(b, -l / 2), P(a, -l / 2), col);
    }
    return this;
  };

  const TONI = {
    prato: [0.33, 0.38, 0.24], arido: [0.50, 0.42, 0.28], cemento: [0.56, 0.56, 0.54], asfalto: [0.20, 0.20, 0.22],
    mare: [0.09, 0.22, 0.32], bianco: [0.88, 0.88, 0.85], grigio: [0.48, 0.50, 0.52], scuro: [0.16, 0.17, 0.19],
    rosso: [0.75, 0.13, 0.13], ruggine: [0.48, 0.25, 0.15], giallo: [0.94, 0.91, 0.28], verde: [0.27, 0.34, 0.20],
    roccia: [0.44, 0.40, 0.36], neve: [0.92, 0.93, 0.95], nave: [0.42, 0.45, 0.48], arancio: [0.85, 0.42, 0.08]
  };

  function suolo(f, col) {
    f.giro(0, -0.25, 0, [[0, 0], [6, 0], [6, 0.25], [0, 0.25]], col, 40);
    return f;
  }

  function caccia(f, x, y, z, scala, col) {
    const s = scala || 1, c = col || TONI.grigio;
    f.tubo(x - 1.2 * s, x + 0.7 * s, y, z, 0.13 * s, c);
    f.tubo(x + 0.7 * s, x + 1.2 * s, y, z, 0.13 * s, c, 0.01);
    f.prisma([[x - 0.5 * s, z - 0.9 * s], [x + 0.2 * s, z - 0.12 * s], [x + 0.2 * s, z + 0.12 * s], [x - 0.5 * s, z + 0.9 * s], [x - 0.75 * s, z + 0.9 * s], [x - 0.5 * s, z], [x - 0.75 * s, z - 0.9 * s]], y - 0.02, 0.04, c);
    f.prisma([[x - 1.2 * s, z - 0.02], [x - 0.75 * s, z - 0.02], [x - 1.05 * s, z + 0.02], [x - 1.2 * s, z + 0.02]], y, 0.42 * s, c);
    return f;
  }

  function nave(f, x, y, z, l, col, ruota) {
    const c = col || TONI.nave, L = l / 2, W = l * 0.09;
    const P = (a, b) => (ruota ? [x + b, z + a] : [x + a, z + b]);
    f.prisma([P(-L, -W), P(L * 0.55, -W), P(L, 0), P(L * 0.55, W), P(-L, W)], y, 0.35, c);
    f.box(x, y + 0.35, z, ruota ? W * 1.4 : L * 0.7, 0.3, ruota ? L * 0.7 : W * 1.4, TONI.bianco);
    f.box(x, y + 0.65, z, ruota ? W * 0.9 : L * 0.25, 0.3, ruota ? L * 0.25 : W * 0.9, TONI.bianco);
    f.cil(x, y + 0.95, z, 0.03, 0.55, TONI.scuro);
    return f;
  }

  function gru(f, x, y, z, col) {
    const c = col || TONI.arancio;
    f.box(x - 0.3, y, z, 0.12, 1.8, 0.12, c);
    f.box(x + 0.3, y, z, 0.12, 1.8, 0.12, c);
    f.box(x, y + 1.8, z, 0.8, 0.25, 0.3, c);
    f.box(x, y + 2.05, z - 0.4, 0.14, 0.14, 2.4, c);
    f.box(x, y + 1.4, z - 1.3, 0.04, 0.65, 0.04, TONI.scuro);
    return f;
  }

  function capannone(f, x, y, z, w, d, h, col) {
    f.box(x, y, z, w, h, d, col);
    f.prisma([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], y + h, 0.06, TONI.scuro);
    return f;
  }

  function parabola(f, x, y, z, r, col) {
    f.cil(x, y, z, r * 0.14, r * 1.1, TONI.grigio);
    const prof = [];
    for (let i = 0; i <= 6; i++) {
      const q = i / 6;
      prof.push([r * q, y * 0 + r * 1.05 + r * 0.42 * q * q]);
    }
    f.giro(x, y, z, prof, col || TONI.bianco, 22);
    return f;
  }

  const MODELLI = {
    aerea(f) {
      suolo(f, TONI.prato);
      f.box(0, 0, 0.8, 10.4, 0.03, 1.6, TONI.asfalto);
      for (let x = -4.5; x < 5; x += 1.3) f.box(x, 0.03, 0.8, 0.7, 0.01, 0.08, TONI.bianco);
      f.volta(-2.6, 0, -1.6, 1.0, 2.2, TONI.grigio);
      f.volta(0.2, 0, -1.6, 1.0, 2.2, TONI.grigio);
      f.volta(3.0, 0, -1.6, 1.0, 2.2, TONI.grigio);
      f.box(-4.4, 0, -2.6, 0.7, 2.1, 0.7, TONI.cemento);
      f.box(-4.4, 2.1, -2.6, 1.0, 0.45, 1.0, TONI.scuro);
      caccia(f, 1.4, 0.3, 0.8, 1.2);
      caccia(f, -2.6, 0.26, 2.6, 0.9);
    },
    aereaNucleare(f) {
      MODELLI.aerea(f);
      f.box(-0.8, 0, 3.6, 2.4, 0.9, 1.3, TONI.cemento);
      f.box(-0.8, 0.9, 3.6, 2.7, 0.08, 1.6, TONI.scuro);
      f.tubo(-1.3, -0.3, 1.35, 3.6, 0.09, TONI.giallo);
    },
    navale(f) {
      f.giro(0, -0.25, 0, [[0, 0], [6, 0], [6, 0.22], [0, 0.22]], TONI.mare, 40);
      f.box(-3.2, -0.25, 0, 3.2, 0.55, 11, TONI.cemento);
      f.box(0.2, -0.05, -1.4, 3.8, 0.28, 0.7, TONI.cemento);
      f.box(0.2, -0.05, 1.8, 3.8, 0.28, 0.7, TONI.cemento);
      nave(f, 1.2, -0.05, 0.2, 4.6);
      nave(f, 1.2, -0.05, 3.2, 3.2);
      f.box(-3.6, 0.3, -2.8, 1.5, 1.0, 2.2, TONI.grigio);
    },
    radar(f) {
      suolo(f, TONI.roccia);
      f.giro(0, 0, 0, [[4.8, 0], [3.2, 0.6], [1.6, 1.1], [0, 1.2]], TONI.verde, 28);
      f.cil(0, 1.1, 0, 0.5, 1.6, TONI.bianco);
      const prof = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8 * Math.PI * 0.6;
        prof.push([1.15 * Math.sin(t + 0.5), 1.15 * Math.cos(t + 0.5)]);
      }
      f.giro(0, 2.5, 0, [[0, 1.15]].concat(prof.reverse().map(([r, h]) => [r, h])).reverse(), TONI.bianco, 24);
      f.box(2.6, 0.45, 1.4, 1.1, 0.7, 0.8, TONI.grigio);
    },
    muos(f) {
      suolo(f, TONI.arido);
      parabola(f, -2.6, 0, 1.2, 1.5);
      parabola(f, 0.4, 0, -1.6, 1.5);
      parabola(f, 2.9, 0, 1.4, 1.5);
      [[-3.4, -2.6], [3.4, -2.4]].forEach(([x, z]) => {
        f.cil(x, 0, z, 0.1, 3.2, TONI.grigio);
        f.giro(x, 2.4, z, [[0.5, 0], [0.5, 0.8]], TONI.scuro, 10);
      });
      f.box(0, 0, 3.2, 2.6, 0.7, 1.0, TONI.bianco);
    },
    poligono(f) {
      suolo(f, TONI.arido);
      [1.7, 1.2, 0.7, 0.25].forEach((r, i) => f.giro(1.2, 0.02 * (i + 1), 0.6, [[0, 0], [r, 0], [r, 0.02], [0, 0.02]], i % 2 ? TONI.rosso : TONI.bianco, 30));
      f.box(-3.4, 0, -1.6, 0.7, 2.2, 0.7, TONI.cemento);
      f.box(-3.4, 2.2, -1.6, 1.1, 0.4, 1.1, TONI.scuro);
      f.box(-2.3, 0, 2.9, 1.3, 0.34, 0.75, TONI.verde, 0.5);
      f.box(-2.3, 0.34, 2.9, 0.65, 0.22, 0.5, TONI.verde, 0.5);
      f.giro(3.2, 0, -2.4, [[1.6, 0], [0.8, 0.8], [0, 0.95]], TONI.roccia, 18);
      f.giro(-1.4, 0, -3.5, [[1.2, 0], [0.5, 0.6], [0, 0.7]], TONI.roccia, 18);
    },
    logistica(f) {
      suolo(f, TONI.prato);
      capannone(f, -2, 0, -2.2, 5.2, 1.5, 0.9, TONI.verde);
      capannone(f, -2, 0, 0, 5.2, 1.5, 0.9, TONI.verde);
      capannone(f, 3.1, 0, -1.2, 1.6, 3.6, 0.9, TONI.cemento);
      f.box(0, 0.02, 2, 11, 0.03, 0.1, TONI.scuro);
      f.box(0, 0.02, 2.4, 11, 0.03, 0.1, TONI.scuro);
      [-3, -1.5, 0, 1.5].forEach((x, i) => f.box(x, 0.06, 2.2, 1.3, 0.5, 0.5, [TONI.ruggine, TONI.grigio, TONI.verde, TONI.ruggine][i]));
    },
    comando(f) {
      suolo(f, TONI.prato);
      f.box(0, 0, -0.6, 4.6, 1.5, 1.5, TONI.cemento);
      f.box(-2.5, 0, 0.5, 1.2, 1.1, 2.8, TONI.cemento);
      f.box(2.5, 0, 0.5, 1.2, 1.1, 2.8, TONI.cemento);
      for (let x = -1.9; x <= 1.9; x += 0.6) f.box(x, 0.5, 0.16, 0.34, 0.6, 0.02, TONI.scuro);
      f.cil(3.3, 0, -2.6, 0.06, 3.6, TONI.grigio);
      f.cil(-3.4, 0, -2.4, 0.04, 2.6, TONI.grigio);
      parabola(f, -1.6, 1.5, -0.8, 0.45);
    },
    esercito(f) {
      suolo(f, TONI.prato);
      [-2.6, 0, 2.6].forEach((x) => f.box(x, 0, -1.8, 2.0, 1.0, 1.1, TONI.cemento));
      f.box(0, 0.01, 1, 7, 0.03, 2.4, TONI.asfalto);
      [-1.8, 0.2, 2.2].forEach((x) => {
        f.box(x, 0.04, 1, 1.2, 0.34, 0.7, TONI.verde);
        f.box(x - 0.1, 0.38, 1, 0.6, 0.2, 0.5, TONI.verde);
        f.tubo(x + 0.1, x + 1.0, 0.48, 1, 0.04, TONI.scuro);
      });
    },
    fabbrica(f) {
      suolo(f, TONI.cemento);
      for (let i = 0; i < 4; i++) {
        const x = -3 + i * 1.5;
        f.box(x, 0, 0, 1.5, 0.9, 3.4, TONI.grigio);
        f.quad([x - 0.75, 0.9, 1.7], [x + 0.75, 0.9, 1.7], [x + 0.75, 1.4, 1.7], [x + 0.75, 1.4, 1.7], TONI.grigio);
        f.prisma([[x - 0.75, -1.7], [x + 0.75, -1.7], [x + 0.75, 1.7], [x - 0.75, 1.7]], 0.9, 0.08, TONI.ruggine);
        f.box(x + 0.68, 0.98, 0, 0.14, 0.42, 3.4, TONI.ruggine);
      }
      f.cil(3.6, 0, -1.5, 0.28, 3.2, TONI.cemento);
      f.cil(3.6, 2.8, -1.5, 0.3, 0.2, TONI.rosso);
      f.cil(3.4, 0, 1.2, 0.7, 1.4, TONI.bianco);
      f.box(-1.2, 0, 3, 3.4, 0.6, 1, TONI.cemento);
    },
    cantiere(f) {
      f.giro(0, -0.25, 0, [[0, 0], [6, 0], [6, 0.22], [0, 0.22]], TONI.mare, 40);
      f.box(-1.6, -0.25, 0, 7.4, 0.5, 5, TONI.cemento);
      nave(f, -0.6, 0.25, 0, 5);
      gru(f, -0.6, 0.25, 2.2);
      gru(f, 1.6, 0.25, 2.2);
      capannone(f, -3.8, 0.25, -1, 2.2, 2.6, 1.3, TONI.grigio);
    },
    porto(f) {
      f.giro(0, -0.25, 0, [[0, 0], [6, 0], [6, 0.22], [0, 0.22]], TONI.mare, 40);
      f.box(-2.6, -0.25, 0, 5.4, 0.55, 11, TONI.cemento);
      nave(f, 2.2, -0.05, 0, 6.4, TONI.ruggine, true);
      [-2.2, 0, 2.2].forEach((z) => { for (let k = 0; k < 2; k++) f.box(2.2, 0.32 + k * 0.28, z * 0.8, 0.8, 0.26, 1.3, k ? TONI.giallo : TONI.rosso); });
      [[-3.8, -3], [-2.8, -3], [-3.8, -1.4], [-2.8, 2.6]].forEach(([x, z], i) => {
        for (let k = 0; k < 3 - i % 2; k++) f.box(x, 0.3 + k * 0.33, z, 0.8, 0.31, 1.4, [TONI.rosso, TONI.grigio, TONI.verde][k]);
      });
      [[0, -2.4], [0, 1.4]].forEach(([, z]) => {
        f.box(0.2, 0.3, z - 0.5, 0.12, 2.4, 0.12, TONI.arancio);
        f.box(0.2, 0.3, z + 0.5, 0.12, 2.4, 0.12, TONI.arancio);
        f.box(1.0, 2.7, z, 4.2, 0.2, 0.2, TONI.arancio);
      });
    },
    mare(f) {
      f.giro(0, -0.25, 0, [[0, 0], [6, 0], [6, 0.22], [0, 0.22]], TONI.mare, 40);
      nave(f, 0, -0.03, 0, 4.2);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, x = 4.4 * Math.cos(a), z = 4.4 * Math.sin(a);
        f.cil(x, -0.05, z, 0.14, 0.3, TONI.giallo);
        f.cil(x, 0.25, z, 0.03, 0.4, TONI.rosso);
      }
    },
    aereo(f) {
      f.giro(0, -0.25, 0, [[0, 0], [6, 0], [6, 0.22], [0, 0.22]], TONI.mare, 40);
      const y = 1.8, c = TONI.bianco;
      f.tubo(-2.9, 2.5, y, 0, 0.32, c);
      f.tubo(2.5, 3.3, y, 0, 0.32, c, 0.04);
      f.tubo(-3.5, -2.9, y, 0, 0.1, c, 0.32);
      f.prisma([[-0.7, -3.1], [0.5, -0.3], [0.5, 0.3], [-0.7, 3.1], [-1.2, 3.1], [-0.7, 0], [-1.2, -3.1]], y - 0.15, 0.08, c);
      f.prisma([[-3.3, -1.2], [-2.8, -0.08], [-2.8, 0.08], [-3.3, 1.2], [-3.6, 1.2], [-3.3, 0], [-3.6, -1.2]], y + 1.0, 0.05, c);
      f.prisma([[-3.3, -0.04], [-2.5, -0.04], [-3.0, 0.04], [-3.3, 0.04]], y, 1.05, c);
      f.tubo(-2.7, -1.6, y + 0.15, 0.55, 0.17, TONI.grigio);
      f.tubo(-2.7, -1.6, y + 0.15, -0.55, 0.17, TONI.grigio);
    },
    funivia(f) {
      suolo(f, TONI.neve);
      f.giro(-2.4, 0, -2.2, [[3.2, 0], [1.6, 1.8], [0.3, 3.4], [0, 3.5]], TONI.roccia, 8);
      f.giro(3, 0, 2.4, [[2.2, 0], [1, 1.1], [0, 1.6]], TONI.roccia, 8);
      const A = [-2.2, 3.3, -2], B = [3, 1.4, 2.2];
      [-0.08, 0.08].forEach((d) => f.quad([A[0] - 0.02, A[1], A[2] + d], [A[0] + 0.02, A[1], A[2] + d], [B[0] + 0.02, B[1], B[2] + d], [B[0] - 0.02, B[1], B[2] + d], TONI.scuro));
      f.cil(0.2, 0, 0, 0.1, 2.4, TONI.grigio);
      f.box(0.9, 1.35, 0.55, 0.05, 0.6, 0.05, TONI.scuro);
      f.box(0.9, 0.75, 0.55, 0.8, 0.6, 0.55, TONI.rosso);
      f.box(0.9, 0.98, 0.55, 0.82, 0.2, 0.57, TONI.bianco);
    }
  };

  /* ---- scena ---- */

  function prospettiva(fov, asp, v, l) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (v - l);
    return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (l + v) * nf, -1, 0, 0, 2 * l * v * nf, 0];
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

  function per(a, b) {
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return m;
  }

  function crea(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) return null;
    const prog = gl.createProgram();
    [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]].forEach(([t, s]) => {
      const sh = gl.createShader(t);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const uVp = gl.getUniformLocation(prog, 'vp');
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    [[0, 0], [1, 12], [2, 24]].forEach(([l, o]) => {
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 36, o);
    });

    const stato = { az: 0.7, el: 0.5, conta: 0, attivo: false, tocco: null, attesa: false };

    function misura() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    function disegna() {
      stato.attesa = false;
      if (!stato.attivo) return;
      misura();
      const d = 13;
      const o = [d * Math.sin(stato.az) * Math.cos(stato.el), d * Math.sin(stato.el) + 0.8, d * Math.cos(stato.az) * Math.cos(stato.el)];
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uVp, false, per(prospettiva(0.62, canvas.width / (canvas.height || 1), 1, 60), guarda(o, [0, 0.7, 0])));
      gl.drawArrays(gl.TRIANGLES, 0, stato.conta);
    }

    function segna() {
      if (stato.attesa) return;
      stato.attesa = true;
      requestAnimationFrame(disegna);
    }

    canvas.addEventListener('pointerdown', (e) => { stato.tocco = { x: e.clientX, y: e.clientY, az: stato.az, el: stato.el }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!stato.tocco) return;
      stato.az = stato.tocco.az - (e.clientX - stato.tocco.x) * 0.012;
      stato.el = Math.max(0.12, Math.min(1.25, stato.tocco.el + (e.clientY - stato.tocco.y) * 0.008));
      segna();
    });
    ['pointerup', 'pointercancel'].forEach((n) => canvas.addEventListener(n, () => { stato.tocco = null; segna(); }));

    return {
      mostra(nome) {
        const f = new Forma();
        (MODELLI[nome] || MODELLI.comando)(f);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(f.d), gl.STATIC_DRAW);
        stato.conta = f.d.length / 9;
        stato.attivo = true;
        stato.az = 0.7;
        misura();
        segna();
      },
      ferma() {
        stato.attivo = false;
      }
    };
  }

  return { crea };
})();
