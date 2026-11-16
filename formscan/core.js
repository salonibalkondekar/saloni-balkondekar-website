/* Form scan core: cuts photos, signatures and name strips out of one scanned
 * "Form to Scan Photograph and Signature of Candidates" sheet (3x3 students).
 * Pure computation on RGBA buffers; runs in a Web Worker and in Node (tests).
 * Port of formscan.py - keep the two in step. */
(function (root) {
  'use strict';
  const CW = 2100, CH = 2940;   // working page width; CH is only the detector's starting size
  const HEADER = 0.0385;        // title strip height as a fraction of the frame
  const ROWS = 3, COLS = 3;
  const DET = 0.5;               // face detector runs on a half-size page

  function createScanner(cv, modelBytes) {
    cv.FS_createDataFile('/', 'yunet.onnx', modelBytes, true, false, false);
    const detector = new cv.FaceDetectorYN('yunet.onnx', '', new cv.Size(CW * DET, CH * DET), 0.6, 0.3, 5000);

    // ---- small helpers over cv.Mat and flat Uint8Array masks ----
    const kernel = (kw, kh) => cv.Mat.ones(kh, kw, cv.CV_8U);
    function morphMat(src, op, kw, kh) {
      const k = kernel(kw, kh), dst = new cv.Mat();
      if (op === 'dilate') cv.dilate(src, dst, k); else cv.morphologyEx(src, dst, cv.MORPH_OPEN, k);
      k.delete();
      return dst;
    }
    function morph(arr, w, h, op, kw, kh) {
      const src = cv.matFromArray(h, w, cv.CV_8UC1, arr), dst = morphMat(src, op, kw, kh);
      const out = dst.data.slice();
      src.delete(); dst.delete();
      return out;
    }
    function components(arr, w, h) {
      const src = cv.matFromArray(h, w, cv.CV_8UC1, arr), lab = new cv.Mat(), st = new cv.Mat(), cen = new cv.Mat();
      const n = cv.connectedComponentsWithStats(src, lab, st, cen, 8, cv.CV_32S);
      const out = { n, lab: lab.data32S.slice(), st: st.data32S.slice() };   // st: x, y, w, h, area per label
      src.delete(); lab.delete(); st.delete(); cen.delete();
      return out;
    }
    function binarize(gray, c) {
      const bw = new cv.Mat();
      cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 51, c);
      return bw;
    }

    // ---- page: find the outer frame and straighten it ----

    /* Outermost ruled-line pixel per column (horiz) or per row, on both sides. */
    function ruledExtremes(bw, horiz, run, minlen) {
      const a = morphMat(bw, 'dilate', horiz ? 1 : 3, horiz ? 3 : 1);          // tolerate a few degrees of tilt
      const b = morphMat(a, 'open', horiz ? run : 1, horiz ? 1 : run);
      const c = morphMat(b, 'dilate', horiz ? 41 : 3, horiz ? 3 : 41);         // bridge gaps
      const lab = new cv.Mat(), st = new cv.Mat(), cen = new cv.Mat();
      const n = cv.connectedComponentsWithStats(c, lab, st, cen, 8, cv.CV_32S);
      const S = st.data32S, keep = new Uint8Array(n);
      for (let i = 1; i < n; i++) keep[i] = S[i * 5 + (horiz ? 2 : 3)] > minlen ? 1 : 0;
      const L = lab.data32S, W = bw.cols, H = bw.rows, N = horiz ? W : H;
      const first = new Int32Array(N).fill(-1), last = new Int32Array(N).fill(-1);
      for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
        if (!keep[L[i]]) continue;
        const k = horiz ? x : y, v = horiz ? y : x;
        if (first[k] < 0 || v < first[k]) first[k] = v;
        if (v > last[k]) last[k] = v;
      }
      [a, b, c, lab, st, cen].forEach(m => m.delete());
      return { first, last };
    }
    function fitEdge(vals, horiz) {
      const pts = [];
      for (let k = 0; k < vals.length; k++) if (vals[k] >= 0) horiz ? pts.push(k, vals[k]) : pts.push(vals[k], k);
      if (pts.length < 100) throw new Error('form frame not found');
      const m = cv.matFromArray(pts.length / 2, 1, cv.CV_32FC2, pts), line = new cv.Mat();
      cv.fitLine(m, line, cv.DIST_HUBER, 0, 0.01, 0.01);
      const [vx, vy, x0, y0] = line.data32F;
      m.delete(); line.delete();
      return { p: [x0, y0], d: [vx, vy] };
    }
    function cross(a, b) {
      const det = a.d[0] * -b.d[1] + b.d[0] * a.d[1];
      const rx = b.p[0] - a.p[0], ry = b.p[1] - a.p[1];
      const t = (rx * -b.d[1] + b.d[0] * ry) / det;
      return [a.p[0] + t * a.d[0], a.p[1] + t * a.d[1]];
    }
    /* Page resized to the working width -> frame warped flat (RGBA Mat). Throws when there is no frame. */
    function straighten(work) {
      const W = work.cols, H = work.rows;
      // the frame is found on a half-size image: its lines are long, so nothing is lost
      const bw = halfBinary(work), hw = bw.cols, hh = bw.rows;
      try {
        const hz = ruledExtremes(bw, true, Math.floor(hw / 25), hw * 0.4);
        const vt = ruledExtremes(bw, false, Math.floor(hw / 25), hh * 0.3);
        const t = fitEdge(hz.first, true), b = fitEdge(hz.last, true), l = fitEdge(vt.first, false), r = fitEdge(vt.last, false);
        const q = [cross(t, l), cross(t, r), cross(b, r), cross(b, l)].map(([x, y]) => [x * W / hw, y * H / hh]);
        let area = 0;
        for (let i = 0; i < 4; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4]; area += x1 * y2 - x2 * y1; }
        if (Math.abs(area) / 2 < 0.5 * W * H) throw new Error('form frame not found');
        const len = (a, c) => Math.hypot(q[a][0] - q[c][0], q[a][1] - q[c][1]);
        const ch = Math.round(CW * (len(0, 3) + len(1, 2)) / (len(0, 1) + len(3, 2)));   // keep the frame's own proportions
        const src = cv.matFromArray(4, 1, cv.CV_32FC2, q.flat());
        const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, CW, 0, CW, ch, 0, ch]);
        const M = cv.getPerspectiveTransform(src, dst), out = new cv.Mat();
        cv.warpPerspective(work, out, M, new cv.Size(CW, ch), cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
        src.delete(); dst.delete(); M.delete();
        return out;
      } finally {
        bw.delete();
      }
    }
    function halfBinary(img) {
      const half = new cv.Mat(), gray = new cv.Mat(), bw = new cv.Mat();
      cv.resize(img, half, new cv.Size(img.cols >> 1, img.rows >> 1), 0, 0, cv.INTER_AREA);
      cv.cvtColor(half, gray, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 25, 10);
      half.delete(); gray.delete();
      return bw;
    }
    function detectFaces(img) {
      const small = new cv.Mat(), bgr = new cv.Mat(), res = new cv.Mat();
      const size = new cv.Size(Math.round(img.cols * DET), Math.round(img.rows * DET));
      cv.resize(img, small, size, 0, 0, cv.INTER_AREA);
      cv.cvtColor(small, bgr, cv.COLOR_RGBA2BGR);
      detector.setInputSize(size);
      detector.detect(bgr, res);
      const faces = [], d = res.data32F;
      for (let i = 0; i < res.rows; i++) faces.push([0, 1, 2, 3].map(k => Math.trunc(d[i * res.cols + k] / DET)));
      small.delete(); bgr.delete(); res.delete();
      return faces;
    }

    /* Rows and columns of the ruled grid inside a straightened sheet -> { ys: [...], xs: [...] } cell boundaries.
     * Uses the ruled lines that cross the whole sheet; a short first/last band (title strip) is dropped.
     * `rows` / `cols` force a count; where lines cannot be trusted the 3x3 candidate sheet is assumed. */
    function findGrid(img, rows, cols) {
      const bw = halfBinary(img), hw = bw.cols, hh = bw.rows;
      const centres = (horiz) => {
        const run = Math.floor(hw / 25);
        const a = morphMat(bw, 'dilate', horiz ? 1 : 3, horiz ? 3 : 1), b = morphMat(a, 'open', horiz ? run : 1, horiz ? 1 : run);
        const c = morphMat(b, 'dilate', horiz ? 41 : 3, horiz ? 3 : 41), lab = new cv.Mat(), st = new cv.Mat(), cen = new cv.Mat();
        const n = cv.connectedComponentsWithStats(c, lab, st, cen, 8, cv.CV_32S), S = st.data32S, out = [];
        for (let i = 1; i < n; i++) {
          const [x, y, w, h] = [S[i * 5], S[i * 5 + 1], S[i * 5 + 2], S[i * 5 + 3]];
          if (horiz ? w > 0.8 * hw : h > 0.6 * hh) out.push(horiz ? (y + h / 2) * 2 : (x + w / 2) * 2);
        }
        [a, b, c, lab, st, cen].forEach(m => m.delete());
        return out;
      };
      const bands = (lines, size, forced) => {
        const tol = 0.03 * size, pts = [0, size];
        for (const v of lines.sort((p, q) => p - q)) if (pts.every(p => Math.abs(p - v) > tol)) pts.push(v);
        pts.sort((p, q) => p - q);
        let b = pts.slice(0, -1).map((p, i) => [Math.round(p), Math.round(pts[i + 1])]);
        const med = () => b.map(([p, q]) => q - p).sort((p, q) => p - q)[b.length >> 1];
        if (b.length > 1 && b[0][1] - b[0][0] < 0.4 * med()) b.shift();                     // title strip
        if (b.length > 1 && b[b.length - 1][1] - b[b.length - 1][0] < 0.4 * med()) b.pop();   // footer strip
        // a title strip whose rule is too faint to see ends up inside the first band: cut it back to size
        if (b.length > 2) {
          const inner = b.slice(1, -1).map(([p, q]) => q - p).sort((p, q) => p - q), m = inner[inner.length >> 1];
          if (b[0][1] - b[0][0] > 1.05 * m) b[0][0] = b[0][1] - m;
          const z = b[b.length - 1];
          if (z[1] - z[0] > 1.05 * m) z[1] = z[0] + m;
        }
        const even = b.every(([p, q]) => Math.abs(q - p - med()) < 0.2 * med());
        if (forced) {                       // split the span between title and footer evenly
          const lo = b[0][0], step = (b[b.length - 1][1] - lo) / forced;
          return Array.from({ length: forced }, (_, i) => [Math.round(lo + i * step), Math.round(lo + (i + 1) * step)]);
        }
        return even && b.length <= 10 ? b : null;
      };
      const ys = bands(centres(true), img.rows, rows), xs = bands(centres(false), img.cols, cols);
      bw.delete();
      if (ys && xs) return { ys, xs, detected: true };
      // lines too faint or broken to trust: assume the standard candidate sheet
      const y0 = img.rows * HEADER, ch = (img.rows - y0) / ROWS, cw = img.cols / COLS;
      return {
        ys: ys || Array.from({ length: ROWS }, (_, r) => [Math.trunc(y0 + r * ch), Math.trunc(y0 + (r + 1) * ch)]),
        xs: xs || Array.from({ length: COLS }, (_, c) => [Math.trunc(c * cw), Math.trunc((c + 1) * cw)]),
      };
    }

    // ---- signature ----

    /* Printed signature rectangle in the lower part of a cell -> [x0, y0, x1, y1] or null. */
    function findSignBox(bw, w, h) {
      const yOff = Math.trunc(h * 0.62), yEnd = Math.trunc(h * 0.975), zh = yEnd - yOff;
      const z = bw.subarray(yOff * w, yEnd * w);
      const hl = morph(morph(z, w, zh, 'open', Math.floor(w / 6), 1), w, zh, 'dilate', 41, 7);
      const { n, st } = components(hl, w, zh);
      const lines = [];
      for (let i = 1; i < n; i++) {
        const s = st.subarray(i * 5, i * 5 + 5);
        if (s[2] > 0.6 * w && s[2] < 0.92 * w) lines.push([s[1] + s[3] / 2, s[0], s[0] + s[2]]);
      }
      let best = null;
      for (const [ya, xa0, xa1] of lines) for (const [yb, xb0, xb1] of lines) {
        const d = (yb - ya) / h;
        if (d > 0.13 && d < 0.24 && Math.abs(xa0 - xb0) < 0.05 * w && Math.abs(xa1 - xb1) < 0.05 * w && (!best || ya > best[1]))
          best = [Math.max(xa0, xb0) + 20, Math.trunc(ya), Math.min(xa1, xb1) - 20, Math.trunc(yb)];
      }
      return best && [best[0], best[1] + yOff, best[2], best[3] + yOff];
    }

    /* Ink inside the box, tight-cropped on white -> {data, w, h} RGBA or null. */
    function cutSignature(C, box) {
      const inset = 11, X0 = box[0] + inset, Y0 = box[1] + inset, W = box[2] - inset - X0, H = box[3] - inset - Y0;
      if (W < 20 || H < 20) return null;
      const ink = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ink[y * W + x] = C.gray[(Y0 + y) * C.w + X0 + x] < 150 ? 1 : 0;
      // group strokes into clusters and drop isolated specks
      const cl = components(morph(ink, W, H, 'dilate', 25, 25), W, H), mass = new Int32Array(cl.n);
      for (let i = 0; i < ink.length; i++) if (ink[i]) mass[cl.lab[i]]++;
      for (let i = 0; i < ink.length; i++) if (mass[cl.lab[i]] < 150) ink[i] = 0;
      const { n, st } = components(ink, W, H);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
      for (let i = 1; i < n; i++) {
        const [x, y, w, h] = st.subarray(i * 5, i * 5 + 4);
        // leftovers of the box border: long thin runs hugging an edge
        if ((h <= 6 && w > 0.3 * W && (y < 4 || y + h > H - 4)) || (w <= 6 && h > 0.3 * H && (x < 4 || x + w > W - 4))) continue;
        bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + w); by1 = Math.max(by1, y + h);
      }
      if (bx1 < 0) return null;
      const m = 14;
      bx0 = Math.max(bx0 - m, 0); by0 = Math.max(by0 - m, 0); bx1 = Math.min(bx1 + m, W); by1 = Math.min(by1 + m, H);
      const w = bx1 - bx0, h = by1 - by0, data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = ((Y0 + by0 + y) * C.w + X0 + bx0 + x) * 4, d = (y * w + x) * 4;
        for (let k = 0; k < 3; k++) data[d + k] = (C.px[s + k] - 40) * 1.5;     // push the paper to pure white, keep ink colour
        data[d + 3] = 255;
      }
      return { data, w, h };
    }

    // ---- photo ----

    /* Pixels of `mask` on straight runs at least `run` long (tolerates ~2 deg tilt). */
    function runs(mask, w, h, horiz, run) {
      return morph(morph(mask, w, h, 'dilate', horiz ? 1 : 3, horiz ? 3 : 1), w, h, 'open', horiz ? run : 1, horiz ? 1 : run);
    }

    /* Picture rectangle around `face` inside the cell -> {rect, notes}.
     * Coloured backgrounds give a solid blob whose straight sides are the picture edges.
     * Where a side is not straight (white background), the edge is the nearest thin line
     * outside the head: the picture's own border, or failing that the edge of the print. */
    function findPhoto(C, face, yTop, yBot) {
      const { w, h, px } = C, [fx, fy, fw, fh] = face;
      const ink = new Uint8Array(w * h);
      for (let y = yTop; y < yBot; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        ink[y * w + x] = Math.min(px[i], px[i + 1], px[i + 2]) < 215 ? 1 : 0;
      }
      const solid = morph(ink, w, h, 'open', 9, 9);
      const { n, lab } = components(solid, w, h), cnt = new Int32Array(n);
      for (let y = Math.max(fy, 0); y < Math.min(fy + fh, h); y++) for (let x = Math.max(fx, 0); x < Math.min(fx + fw, w); x++) cnt[lab[y * w + x]]++;
      let id = 0;
      for (let i = 1; i < n; i++) if (cnt[i] > (id ? cnt[id] : 0)) id = i;
      if (!id) return { rect: null, notes: ['no picture around face'] };
      const comp = (x, y) => lab[y * w + x] === id;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (comp(x, y)) {
        if (x < x0) x0 = x; if (x >= x1) x1 = x + 1; if (y < y0) y0 = y; if (y >= y1) y1 = y + 1;
      }
      // how much of each side of the blob lies flush against its bounding box
      const bwid = x1 - x0, bhgt = y1 - y0, t = 7, f = { l: 0, r: 0, t: 0, b: 0 };
      let nr = 0, nc = 0;
      for (let y = y0; y < y1; y++) {
        let a = -1, b = -1;
        for (let x = x0; x < x1; x++) if (comp(x, y)) { if (a < 0) a = x; b = x; }
        if (a < 0) continue;
        nr++; if (a - x0 < t) f.l++; if (b - x0 >= bwid - t) f.r++;
      }
      for (let x = x0; x < x1; x++) {
        let a = -1, b = -1;
        for (let y = y0; y < y1; y++) if (comp(x, y)) { if (a < 0) a = y; b = y; }
        if (a < 0) continue;
        nc++; if (a - y0 < t) f.t++; if (b - y0 >= bhgt - t) f.b++;
      }
      const straight = { l: f.l / nr > 0.6, r: f.r / nr > 0.6, t: f.t / nc > 0.6, b: f.b / nc > 0.5 };

      const faint = C.faint, near = morph(solid, w, h, 'dilate', 7, 7), thin = new Uint8Array(w * h);
      for (let y = yTop; y < yBot; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        thin[i] = (ink[i] || faint[i]) && !near[i] ? 1 : 0;
      }
      const vl = runs(thin, w, h, false, Math.trunc(fh * 0.6)), hl = runs(thin, w, h, true, Math.trunc(fw * 0.6));
      const b0 = Math.max(fy - Math.floor(fh / 3), 0), b1 = Math.min(fy + fh + Math.floor(fh / 4), h);   // rows crossing the head
      let hx0 = fx, hx1 = fx + fw;
      for (let y = b0; y < b1; y++) for (let x = 0; x < w; x++) if (comp(x, y)) { if (x < hx0) hx0 = x; if (x + 1 > hx1) hx1 = x + 1; }
      const bandRuns = runs(thin.subarray(b0 * w, b1 * w), w, b1 - b0, false, Math.trunc(fh * 0.6));
      const vcols = [], trows = [], brows = [];
      for (let x = 0; x < w; x++) for (let y = 0; y < b1 - b0; y++) if (bandRuns[y * w + x]) { vcols.push(x); break; }
      const c0 = Math.max(fx - Math.floor(fw / 2), 0), c1 = Math.min(fx + fw + Math.floor(fw / 2), w);   // columns crossing the head
      for (let y = 0; y < h; y++) {
        for (let x = c0; x < c1; x++) if (hl[y * w + x]) { trows.push(y); break; }
        for (let x = x0; x < x1; x++) if (hl[y * w + x]) { brows.push(y); break; }
      }
      const lim = {}, notes = [], NAME = { l: 'left', r: 'right', t: 'top', b: 'bottom' };
      /* Innermost thin line between the head and `bound`, else `fallback`. */
      function pick(side, cands, bound, fallback, inner) {
        cands = cands.filter(v => inner === 'max' ? v > bound : v < bound);
        if (cands.length) lim[side] = inner === 'max' ? Math.max(...cands) + 6 : Math.min(...cands) - 6;
        else { lim[side] = Math.trunc(fallback); notes.push(NAME[side] + ' edge guessed'); }
      }
      if (straight.l) lim.l = x0 + 3; else pick('l', vcols.filter(v => v < hx0 - 3), fx - 1.5 * fw, Math.max(fx - 0.8 * fw, 0), 'max');
      if (straight.r) lim.r = x1 - 3; else pick('r', vcols.filter(v => v > hx1 + 3), fx + 2.5 * fw, Math.min(fx + 1.8 * fw, w), 'min');
      if (straight.t) lim.t = y0 + 3; else pick('t', trows.filter(v => v < y0 - 3), yTop, Math.max(fy - 0.7 * fh, yTop), 'max');
      if (straight.b) lim.b = y1 - 3; else pick('b', brows.filter(v => v > y1 + 3), yBot, Math.min(fy + 2.6 * fh, yBot), 'min');

      // one side found, the other guessed: a passport photo is centred on the face, so mirror the known side
      {
        const mid = fx + fw / 2, gl = notes.includes('left edge guessed'), gr = notes.includes('right edge guessed');
        if (gl && !gr) { lim.l = Math.max(Math.trunc(2 * mid - lim.r), Math.trunc(fx - 1.5 * fw), 0); notes.splice(notes.indexOf('left edge guessed'), 1); }
        if (gr && !gl) { lim.r = Math.min(Math.trunc(2 * mid - lim.l), Math.trunc(fx + 2.5 * fw), w); notes.splice(notes.indexOf('right edge guessed'), 1); }
      }

      // mean of a mask along columns / rows of the current rectangle
      const colMean = (m, l, t_, r, b) => { const o = new Float32Array(r - l); for (let x = l; x < r; x++) { let s = 0; for (let y = t_; y < b; y++) s += m[y * w + x]; o[x - l] = s / (b - t_); } return o; };
      const rowMean = (m, l, t_, r, b) => { const o = new Float32Array(b - t_); for (let y = t_; y < b; y++) { let s = 0; for (let x = l; x < r; x++) s += m[y * w + x]; o[y - t_] = s / (r - l); } return o; };
      const cover = (m) => { const o = new Float32Array(m.length); for (let i = 0; i < m.length; i++) { let s = 0; for (let j = Math.max(i - 4, 0); j <= Math.min(i + 4, m.length - 1); j++) s += m[j]; o[i] = s; } return o; };
      const firstIdx = (a, from, to, test) => { for (let i = from; i < to; i++) if (test(a[i])) return i; return -1; };
      const lastIdx = (a, from, to, test) => { for (let i = to - 1; i >= from; i--) if (test(a[i])) return i; return -1; };

      // a border line may sit inside a guessed side (e.g. hair touching it): pull the side inside it
      {
        const { l, t: t_, r, b } = lim, mx = Math.trunc(0.18 * (r - l)), my = Math.trunc(0.18 * (b - t_));
        const cv_ = cover(colMean(vl, l, t_, r, b)), ch_ = cover(rowMean(hl, l, t_, r, b)), hit = v => v > 0.5;
        let k;
        if (!straight.l && (k = lastIdx(cv_, 0, mx, hit)) >= 0) lim.l = l + k + 6;
        if (!straight.r && (k = firstIdx(cv_, cv_.length - mx, cv_.length, hit)) >= 0) lim.r = l + k - 6;
        if (!straight.t && (k = lastIdx(ch_, 0, my, hit)) >= 0) lim.t = t_ + k + 6;
        if (!straight.b && (k = firstIdx(ch_, ch_.length - my, ch_.length, hit)) >= 0) lim.b = t_ + k - 6;
      }
      // a border that spans the whole side (even where hair or clothes touch it): move the side onto it,
      // the shave below then removes the border itself
      {
        const { l, t: t_, r, b } = lim, mx = Math.trunc(0.18 * (r - l)), my = Math.trunc(0.18 * (b - t_));
        const cc = colMean(ink, l, t_, r, b), cr = rowMean(ink, l, t_, r, b), hit = v => v >= 0.8;
        let k;
        if (!straight.l && (k = firstIdx(cc, 0, mx, hit)) >= 0) lim.l = l + k;
        if (!straight.r && (k = lastIdx(cc, cc.length - mx, cc.length, hit)) >= 0) lim.r = l + k + 1;
        if (!straight.t && (k = firstIdx(cr, 0, my, hit)) >= 0) lim.t = t_ + k;
        if (!straight.b && (k = lastIdx(cr, cr.length - my, cr.length, hit)) >= 0) lim.b = t_ + k + 1;
      }
      // shave edges that are a different thing from what lies just inside them
      // (black / coloured border lines, slivers of white print margin)
      const differs = (xa, ya, xb, yb) => {
        const a = (ya * w + xa) * 4, b = (yb * w + xb) * 4;
        return Math.max(Math.abs(px[a] - px[b]), Math.abs(px[a + 1] - px[b + 1]), Math.abs(px[a + 2] - px[b + 2])) > 60;
      };
      const alienCol = (x, dx, t_, b) => { let s = 0; for (let y = t_; y < b; y++) if (differs(x, y, x + dx, y)) s++; return s / (b - t_) > 0.6; };
      const alienRow = (y, dy, l, r) => { let s = 0; for (let x = l; x < r; x++) if (differs(x, y, x, y + dy)) s++; return s / (r - l) > 0.6; };
      for (let i = 0; i < 80; i++) {
        const { l, t: t_, r, b } = lim;
        if (r - l < 60 || b - t_ < 60) break;
        if (alienCol(l, 10, t_, b) || alienCol(l, 24, t_, b)) lim.l++;
        else if (alienCol(r - 1, -10, t_, b) || alienCol(r - 1, -24, t_, b)) lim.r--;
        else if (alienRow(t_, 10, l, r) || alienRow(t_, 24, l, r)) lim.t++;
        else if (alienRow(b - 1, -10, l, r)) lim.b--;
        else break;
      }
      return { rect: [lim.l, lim.t, lim.r, lim.b], notes };
    }

    /* Largest rect of the given w/h aspect inside `rect`, centred on the face, head near the top. */
    function frameToAspect(rect, face, aspect) {
      const [x0, y0, x1, y1] = rect, [fx, fy, fw, fh] = face, w = x1 - x0, h = y1 - y0;
      if (w / h > aspect) {                    // too wide: trim sides around the face
        const nw = h * aspect, nx = Math.min(Math.max(fx + fw / 2 - nw / 2, x0), x1 - nw);
        return [Math.trunc(nx), y0, Math.trunc(nx + nw), y1];
      }
      const nh = w / aspect, ny = Math.min(Math.max(fy - 0.75 * fh, y0), y1 - nh);   // too tall: keep headroom
      return [x0, Math.trunc(ny), x1, Math.trunc(ny + nh)];
    }

    // ---- output ----

    function cropRGBA(C, x0, y0, x1, y1) {
      const w = x1 - x0, h = y1 - y0, data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) data.set(C.px.subarray(((y0 + y) * C.w + x0) * 4, ((y0 + y) * C.w + x1) * 4), y * w * 4);
      return { data, w, h };
    }
    function resizeRGBA(im, tw, th) {
      const src = cv.matFromArray(im.h, im.w, cv.CV_8UC4, im.data), dst = new cv.Mat();
      cv.resize(src, dst, new cv.Size(tw, th), 0, 0, tw < im.w ? cv.INTER_AREA : cv.INTER_CUBIC);
      const out = { data: new Uint8ClampedArray(dst.data), w: tw, h: th };
      src.delete(); dst.delete();
      return out;
    }
    function padRGBA(im, tw, th) {             // shrink to fit, centre on white
      const s = Math.min(1, tw / im.w, th / im.h), w = Math.max(1, Math.round(im.w * s)), h = Math.max(1, Math.round(im.h * s));
      const small = s < 1 ? resizeRGBA(im, w, h) : im, data = new Uint8ClampedArray(tw * th * 4).fill(255);
      const ox = (tw - w) >> 1, oy = (th - h) >> 1;
      for (let y = 0; y < h; y++) data.set(small.data.subarray(y * w * 4, (y + 1) * w * 4), ((oy + y) * tw + ox) * 4);
      return { data, w: tw, h: th };
    }

    /* Pixels of one region, scaled by k so the fixed pixel sizes used above fit it. */
    function regionPixels(img, x0, y0, w, h, k) {
      const roi = img.roi(new cv.Rect(x0, y0, w, h)), full = new cv.Mat(), gray = new cv.Mat();
      roi.copyTo(full);                         // not clone(): in OpenCV.js a cloned ROI keeps the parent's layout
      let cell = full;
      if (Math.abs(k - 1) > 0.03) {
        cell = new cv.Mat();
        cv.resize(full, cell, new cv.Size(Math.round(w * k), Math.round(h * k)), 0, 0, k < 1 ? cv.INTER_AREA : cv.INTER_CUBIC);
      } else k = 1;
      cv.cvtColor(cell, gray, cv.COLOR_RGBA2GRAY);
      const adaptive = c => { const m = binarize(gray, c), a = m.data.slice(); m.delete(); return a; };
      const C = { w: cell.cols, h: cell.rows, k, px: cell.data.slice(), gray: gray.data.slice(), faint: adaptive(8), bw15: adaptive(15), bw7: adaptive(7),
                  full: { w, h, px: cell === full ? null : full.data.slice() } };
      if (!C.full.px) C.full.px = C.px;
      roi.delete(); gray.delete(); if (cell !== full) cell.delete(); full.delete();
      return C;
    }
    /* Photo for a face (in C's scaled coordinates), cut from the full-resolution pixels. */
    function cutPhoto(C, f, yTop, yBot, opts, flags) {
      const { rect, notes } = findPhoto(C, f, yTop, yBot);
      if (!rect || rect[2] - rect[0] < 1.3 * f[2] || rect[3] - rect[1] < 1.5 * f[3]) flags.push('photo crop doubtful');
      if (notes.length >= 2) flags.push('photo edges unclear');
      if (!rect || rect[2] - rect[0] <= 20 || rect[3] - rect[1] <= 20) return { photo: null, crop: null, notes };
      const F = C.full, q = frameToAspect(rect, f, opts.photo[0] / opts.photo[1]).map(v => v / C.k);
      const at = [Math.max(Math.round(q[0]), 0), Math.max(Math.round(q[1]), 0), Math.min(Math.round(q[2]), F.w), Math.min(Math.round(q[3]), F.h)];
      // `crop` is where the photo sits in the region, so the page can offer to adjust it
      return { photo: resizeRGBA(cropRGBA(F, ...at), opts.photo[0], opts.photo[1]), crop: at, notes };
    }

    const CELL = 700, FACE = 135;       // cell width / face width the pixel sizes above were tuned for

    function scanGrid(work, opts) {
      const img = straighten(work), students = [];
      let layout = '';
      try {
        const faces = detectFaces(img), grid = findGrid(img, opts.rows, opts.cols), { ys, xs } = grid;
        layout = `${ys.length} x ${xs.length}${grid.detected ? '' : ' (assumed)'}`;
        ys.forEach(([cy0, cy1], r) => xs.forEach(([cx0, cx1], c) => {
          const C = regionPixels(img, cx0, cy0, cx1 - cx0, cy1 - cy0, CELL / (cx1 - cx0)), { w, h, k } = C;
          const box = findSignBox(C.bw15, w, h) || findSignBox(C.bw7, w, h);
          const sig = box && cutSignature(C, box);
          const inside = faces.filter(f => { const x = f[0] + f[2] / 2, y = f[1] + f[3] / 2; return x > cx0 && x < cx1 && y > cy0 && y < cy1; });
          if (!inside.length && !sig) return;                                     // empty cell
          const big = inside.sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
          const flags = [], st = { sr: r * xs.length + c + 1, photo: null, sign: null, crop: null, flags, notes: [] };
          st.cell = { data: new Uint8ClampedArray(C.full.px), w: C.full.w, h: C.full.h };     // the whole cell, for adjusting a crop by hand

          const sh0 = Math.trunc(h * 0.005), sh1 = Math.trunc(h * 0.2);
          st.name = cropRGBA(C, 6, sh0, w - 6, sh1);
          // handwriting right of the "Name :" label, printed underline removed
          const zx = 6 + Math.trunc(w * 0.24), zy0 = sh0 + Math.trunc((sh1 - sh0) * 0.45), zy1 = sh0 + Math.trunc((sh1 - sh0) * 0.9);
          const zw = w - 6 - zx, zh = zy1 - zy0, pen = new Uint8Array(zw * zh);
          for (let y = 0; y < zh; y++) for (let x = 0; x < zw; x++) {
            const i = ((zy0 + y) * w + zx + x) * 4, lo = Math.min(C.px[i], C.px[i + 1], C.px[i + 2]), hi = Math.max(C.px[i], C.px[i + 1], C.px[i + 2]);
            pen[y * zw + x] = lo < 170 || hi - lo > 50 ? 1 : 0;
          }
          const under = morph(morph(pen, zw, zh, 'open', 80, 1), zw, zh, 'dilate', 1, 5);
          let inkCount = 0;
          for (let i = 0; i < pen.length; i++) if (pen[i] && !under[i]) inkCount++;
          st.nameWritten = inkCount >= 500;
          if (!st.nameWritten) flags.push('name not written on form');
          // the handwriting alone, on white, for the name reader
          const hw0 = Math.trunc((sh1 - sh0) * 0.32), hand = cropRGBA(C, 6, sh0 + hw0, w - 6, sh1), hn = hand.w * hand.h;
          const lo = new Uint8Array(hn), mask = new Uint8Array(hn);
          let coloured = 0;
          for (let i = 0; i < hn; i++) {
            const r = hand.data[i * 4], g = hand.data[i * 4 + 1], b = hand.data[i * 4 + 2];
            lo[i] = Math.min(r, g, b);
            if (Math.max(r, g, b) - lo[i] > 45 && lo[i] < 190) { mask[i] = 1; coloured++; }   // pen ink is coloured, the print is grey
          }
          if (coloured < 600) {             // black pen: take dark ink instead, minus the printed label and underline
            for (let i = 0; i < hn; i++) mask[i] = lo[i] < 130 ? 1 : 0;
            const line = morph(morph(mask, hand.w, hand.h, 'open', 80, 1), hand.w, hand.h, 'dilate', 1, 7);
            const lx = Math.trunc(hand.w * 0.2), ly = Math.trunc(hand.h * 0.5);
            for (let y = 0; y < hand.h; y++) for (let x = 0; x < hand.w; x++) {
              const i = y * hand.w + x;
              if (line[i] || (x < lx && y > ly) || y < hand.h * 0.2) mask[i] = 0;
            }
            // specks, the label's colon, and slivers of the cell border
            const cc = components(mask, hand.w, hand.h), drop = new Uint8Array(cc.n);
            for (let j = 1; j < cc.n; j++) {
              const [x, , cw_, ch_, area] = cc.st.subarray(j * 5, j * 5 + 5);
              drop[j] = area < 40 || (cw_ <= 8 && (x < 12 || x + cw_ > hand.w - 12)) ? 1 : 0;
            }
            for (let i = 0; i < hn; i++) if (drop[cc.lab[i]]) mask[i] = 0;
          }
          for (let i = 0; i < hn; i++) hand.data[i * 4] = hand.data[i * 4 + 1] = hand.data[i * 4 + 2] = mask[i] ? Math.max(0, lo[i] - 60) : 255;
          st.hand = hand;

          if (sig) st.sign = padRGBA(sig, opts.sign[0], opts.sign[1]); else flags.push('signature not found');
          if (!big) flags.push('photo not found');
          else {
            const f = [(big[0] - cx0) * k, (big[1] - cy0) * k, big[2] * k, big[3] * k].map(Math.round);
            Object.assign(st, cutPhoto(C, f, Math.trunc(h * 0.2), box ? box[1] : Math.trunc(h * 0.74), opts, flags));
          }
          students.push(st);
        }));
      } finally { img.delete(); }
      return { students, layout };
    }

    /* Any page: every passport photo on it, no grid, no signatures. */
    function scanPhotos(work, opts) {
      const faces = detectFaces(work).filter(f => f[2] >= 45), students = [];
      const rowOf = f => Math.round((f[1] + f[3] / 2) / (1.5 * f[3]));
      faces.sort((a, b) => rowOf(a) - rowOf(b) || a[0] - b[0]);
      faces.forEach(([fx, fy, fw, fh], i) => {
        const x0 = Math.max(Math.round(fx - 2.1 * fw), 0), y0 = Math.max(Math.round(fy - 1.6 * fh), 0);
        const x1 = Math.min(Math.round(fx + 3.1 * fw), work.cols), y1 = Math.min(Math.round(fy + 4.2 * fh), work.rows);
        const C = regionPixels(work, x0, y0, x1 - x0, y1 - y0, FACE / fw), flags = [];
        const f = [(fx - x0) * C.k, (fy - y0) * C.k, fw * C.k, fh * C.k].map(Math.round);
        const st = { sr: i + 1, sign: null, name: null, hand: null, nameWritten: false, flags, ...cutPhoto(C, f, 0, C.h, opts, flags),
                     cell: { data: new Uint8ClampedArray(C.full.px), w: C.full.w, h: C.full.h } };
        if (st.photo) students.push(st);
      });
      return { students, layout: 'photos' };
    }

    /* One page (RGBA) -> { students, layout }.
     * opts: { photo: [w, h], sign: [w, h], mode: 'grid' | 'photos', rows, cols }
     * 'grid' throws when the sheet's printed frame is not found. */
    function scanPage(rgba, width, height, opts) {
      const page = cv.matFromArray(height, width, cv.CV_8UC4, rgba), work = new cv.Mat();
      try {
        cv.resize(page, work, new cv.Size(CW, Math.round(height * CW / width)), 0, 0, width > CW ? cv.INTER_AREA : cv.INTER_CUBIC);
        return opts.mode === 'photos' ? scanPhotos(work, opts) : scanGrid(work, opts);
      } finally { page.delete(); work.delete(); }
    }

    return { scanPage };
  }

  const api = { createScanner, CW, CH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FormScan = api;
})(typeof self !== 'undefined' ? self : this);
