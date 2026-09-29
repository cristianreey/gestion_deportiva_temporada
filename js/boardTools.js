/*
 * boardTools.js
 * Utilidades PURAS (sin DOM) de la Pizarra Táctica: geometría del dibujo libre,
 * flechas, borrador y redimensionado/rotación de elementos.
 * Se separan de tactics.js para que sean fáciles de probar y de mantener.
 *
 * Convenciones:
 *  - Los dibujos se guardan con coordenadas NORMALIZADAS (0..1) respecto al lienzo,
 *    así se ven igual en ordenador y en móvil y sobreviven a cambios de tamaño.
 *  - El grosor de un trazo se guarda como "px a 800 px de ancho de lienzo" y se
 *    escala con el ancho real del lienzo (ver strokePx).
 */

/** Colores disponibles para dibujar. */
export const DRAW_COLORS = [
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Amarillo', value: '#ffd60a' },
  { name: 'Rojo', value: '#e5383b' },
  { name: 'Azul', value: '#1d75bd' },
  { name: 'Negro', value: '#111111' }
];

/** Límites de tamaño de los elementos. */
export const MIN_OBJ_PX = 16;      // tamaño mínimo (px) por lado
export const MAX_OBJ_FRAC = 0.8;   // tamaño máximo: 80 % del lienzo por lado
export const EDGE_MARGIN_PX = 6;   // margen mínimo respecto al borde del lienzo

export const clampNum = (n, a, b) => Math.max(a, Math.min(b, n));
export const round = (v, d = 4) => { const k = 10 ** d; return Math.round(v * k) / k; };
const f1 = v => Math.round(v * 100) / 100;

/** Grosor real en px según el ancho del lienzo (nunca menos de `min` px). */
export const strokePx = (w, canvasW, min = 1.5) => Math.max(min, (w * canvasW) / 800);

/* ----------------------------------------------------------------------------
 * DIBUJO
 * ------------------------------------------------------------------------- */

/**
 * Convierte una lista de puntos (px) en un trazo suave: curvas cuadráticas
 * que pasan por los puntos medios de cada par (evita el aspecto "quebrado").
 */
export function smoothPath(p) {
  if (!p.length) return '';
  const [x0, y0] = p[0];
  if (p.length === 1) return `M${f1(x0)} ${f1(y0)}l0.01 0`;      // un toque = punto
  if (p.length === 2) return `M${f1(x0)} ${f1(y0)}L${f1(p[1][0])} ${f1(p[1][1])}`;
  let d = `M${f1(x0)} ${f1(y0)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    d += `Q${f1(p[i][0])} ${f1(p[i][1])} ${f1(mx)} ${f1(my)}`;
  }
  const l = p[p.length - 1];
  return d + `L${f1(l[0])} ${f1(l[1])}`;
}

/** Geometría de una flecha a→b (px): tramo de línea y triángulo de la punta. */
export function arrowGeometry(a, b, widthPx) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const hl = Math.min(len * 0.7, Math.max(12, widthPx * 4));      // largo de la punta
  const hw = hl * 0.45;                                           // semiancho de la punta
  const bx = b[0] - ux * hl, by = b[1] - uy * hl;                 // base de la punta
  return {
    lineEnd: [b[0] - ux * hl * 0.8, b[1] - uy * hl * 0.8],
    head: [b, [bx + nx * hw, by + ny * hw], [bx - nx * hw, by - ny * hw]]
  };
}

/**
 * Marcado SVG de un dibujo guardado (coordenadas normalizadas) para un lienzo W×H.
 * Sirve tanto para la capa de dibujo como para la miniatura del ejercicio.
 */
export function drawingMarkup(d, W, H, minStroke = 1.5) {
  const pts = d.pts.map(([x, y]) => [x * W, y * H]);
  const sw = strokePx(d.width, W, minStroke);
  const base = `fill="none" stroke="${d.color}" stroke-width="${f1(sw)}" stroke-linecap="round" stroke-linejoin="round"`;
  if (d.type === 'arrow' && pts.length >= 2) {
    const g = arrowGeometry(pts[0], pts[1], sw);
    const tri = g.head.map(q => `${f1(q[0])},${f1(q[1])}`).join(' ');
    return `<path ${base} d="M${f1(pts[0][0])} ${f1(pts[0][1])}L${f1(g.lineEnd[0])} ${f1(g.lineEnd[1])}"/>` +
           `<polygon points="${tri}" fill="${d.color}" stroke="${d.color}" stroke-width="${f1(sw * 0.5)}" stroke-linejoin="round"/>`;
  }
  if (d.type === 'line' && pts.length >= 2) {
    return `<path ${base} d="M${f1(pts[0][0])} ${f1(pts[0][1])}L${f1(pts[1][0])} ${f1(pts[1][1])}"/>`;
  }
  return `<path ${base} d="${smoothPath(pts)}"/>`;
}

/** Distancia del punto p al segmento a-b. */
export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = clampNum(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** ¿El punto p (px) toca el dibujo d? `tol` es la tolerancia extra en px. */
export function hitDrawing(d, p, W, H, tol = 8) {
  const pts = d.pts.map(([x, y]) => [x * W, y * H]);
  const reach = tol + strokePx(d.width, W) / 2;
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= reach;
  for (let i = 0; i < pts.length - 1; i++) if (distToSegment(p, pts[i], pts[i + 1]) <= reach) return true;
  return false;
}

/** Fuerza el ángulo del segmento a→b a múltiplos de 45° (línea recta con Mayús). */
export function snapLine45(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len];
}

/* ----------------------------------------------------------------------------
 * ELEMENTOS: rotación, límites y redimensionado
 * ------------------------------------------------------------------------- */

/** Gira el vector (x,y) `deg` grados. */
export function rotateVec(x, y, deg) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

/** Normaliza un ángulo a (-180, 180]. */
export function normAngle(deg) {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

/** Ajuste al giro: imán suave a múltiplos de 15° o, con `hard`, ajuste total. */
export function snapAngle(deg, hard = false) {
  const near = Math.round(deg / 15) * 15;
  return normAngle(round(hard || Math.abs(deg - near) < 3 ? near : deg, 1));
}

/** Semiextensiones (px) del rectángulo envolvente de una caja girada. */
export function aabbHalf(w, h, rot) {
  const r = (rot * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  return [(w * c + h * s) / 2, (w * s + h * c) / 2];
}

/** Mantiene el centro para que la caja (girada) no se salga del lienzo. */
export function fitCenter(cx, cy, w, h, rot, W, H, m = EDGE_MARGIN_PX) {
  const [hx, hy] = aabbHalf(w, h, rot);
  return {
    cx: 2 * (hx + m) >= W ? W / 2 : clampNum(cx, hx + m, W - hx - m),
    cy: 2 * (hy + m) >= H ? H / 2 : clampNum(cy, hy + m, H - hy - m)
  };
}

/** Límites de tamaño (px) para un lienzo W×H. */
export const sizeLimits = (W, H) => ({
  minW: MIN_OBJ_PX, minH: MIN_OBJ_PX, maxW: W * MAX_OBJ_FRAC, maxH: H * MAX_OBJ_FRAC
});

/** Signos (x,y) de cada tirador respecto al centro de la caja. */
export const HANDLES = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
  se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0]
};

/**
 * Calcula el nuevo tamaño al arrastrar un tirador.
 *  handle: 'nw'|'n'|...   start: {w,h} px al empezar   dl: {x,y} desplazamiento
 *  del puntero en el sistema LOCAL del elemento (ya des-rotado)   keep: mantener
 *  proporción (Mayús en laterales)   lim: sizeLimits()
 * Devuelve {w,h} y {dx,dy}: desplazamiento LOCAL del centro para que el lado
 * opuesto al tirador permanezca fijo (como en PowerPoint/Canva).
 */
export function computeResize(handle, start, dl, keep, lim) {
  const [sx, sy] = HANDLES[handle];
  const { w: w0, h: h0 } = start;
  let w = w0 + sx * dl.x, h = h0 + sy * dl.y;
  if ((sx && sy) || keep) {
    // Escala uniforme: esquinas siempre; laterales solo con Mayús.
    let s = sx && sy ? (w / w0 + h / h0) / 2 : sx ? w / w0 : h / h0;
    const sMax = Math.min(lim.maxW / w0, lim.maxH / h0);
    const sMin = Math.min(Math.max(lim.minW / w0, lim.minH / h0), sMax);
    s = clampNum(s, sMin, sMax);
    w = w0 * s; h = h0 * s;
  } else {
    w = sx ? clampNum(w, lim.minW, Math.max(lim.maxW, w0)) : w0;
    h = sy ? clampNum(h, lim.minH, Math.max(lim.maxH, h0)) : h0;
  }
  return { w, h, dx: (sx * (w - w0)) / 2, dy: (sy * (h - h0)) / 2 };
}

/** Cursor adecuado para un tirador teniendo en cuenta el giro del elemento. */
export function cursorFor(handle, rot) {
  const base = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 }[handle];
  const a = (((base + rot) % 180) + 180) % 180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(a / 45) % 4];
}
