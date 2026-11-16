/* Reading handwritten names: OCR drafts (tesseract.js, Marathi) and matching them to a class list.
 * OCR alone gets roughly 60% of characters right on handwriting, so a draft always needs a look;
 * matched against a known list of names it is usually enough to pick the right student. */

let ocr;       // promise of a tesseract worker, created on first use
function reader() {
  ocr ??= (async () => {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = resolve; s.onerror = () => reject(new Error('could not load the name reader'));
      document.head.appendChild(s);
    });
    const base = new URL('./vendor/tesseract/', import.meta.url).href;
    const w = await Tesseract.createWorker('mar', 1, { workerPath: base + 'worker.min.js', corePath: base.replace(/\/$/, ''), langPath: base.replace(/\/$/, ''), gzip: true });
    await w.setParameters({ tessedit_pageseg_mode: '7' });       // one line of text
    return w;
  })();
  return ocr;
}

/* PNG blob of isolated handwriting -> text ('' when nothing readable). */
export async function readName(blob) {
  const { data } = await (await reader()).recognize(blob);
  return clean(data.text);
}

const clean = s => s.normalize('NFC').replace(/[^ऀ-ॿ A-Za-z]/g, ' ').replace(/\s+/g, ' ').trim();
const words = s => clean(s).toLowerCase().split(' ').filter(Boolean);

function similarity(a, b) {       // 1 - edit distance / longer length
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}
/* How well a reading fits a listed name, ignoring word order (surname first or last). */
function fit(reading, listed) {
  const r = words(reading), l = words(listed);
  if (!r.length || !l.length) return 0;
  let sum = 0, len = 0;
  for (const w of l) { sum += Math.max(...r.map(x => similarity(w, x))) * w.length; len += w.length; }
  return sum / len;
}

/* Pasted class list -> [{ name, cells }]. One student per line; columns split on tabs or commas.
 * The name is the Devanagari text of the line when there is any, else the longest cell. */
export function parseList(text) {
  return text.split(/\r?\n/).map(line => line.split(/\t|,/).map(c => c.trim()).filter(Boolean)).filter(c => c.length).map(cells => {
    const deva = cells.filter(c => /[ऀ-ॿ]/.test(c));
    return { name: deva.length ? deva.sort((a, b) => b.length - a.length)[0] : cells.slice().sort((a, b) => b.length - a.length)[0], cells };
  });
}

/* Give each reading its best unused list entry. readings: [text], list: [{ name }]
 * -> [{ index, sure } | null] per reading. `sure` is false when the fit is weak or another name fits nearly as well. */
export function matchNames(readings, list) {
  const pairs = [];
  readings.forEach((r, i) => r && list.forEach((l, j) => { const s = fit(r, l.name); if (s >= 0.3) pairs.push([s, i, j]); }));
  pairs.sort((a, b) => b[0] - a[0]);
  const out = readings.map(() => null), used = new Set();
  for (const [s, i, j] of pairs) {
    if (out[i] || used.has(j)) continue;
    used.add(j);
    const rival = Math.max(0, ...pairs.filter(p => p[1] === i && p[2] !== j).map(p => p[0]));
    out[i] = { index: j, sure: s >= 0.45 && s - rival >= 0.06 };
  }
  return out;
}
