import * as pdfjs from './vendor/pdf.min.mjs';
import { makeZip } from './zip.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const PAGE_WIDTH = 2200;                    // px a page is rendered at before processing
const STORE = 'formscan:v1:';               // localStorage prefix: options, crops fixed by hand
const $ = id => document.getElementById(id);
const students = [], files = [];            // people found, in page order; every file added so far
let pagesDone = 0, busy = false;
const setState = s => { document.body.dataset.state = s; };

// ---- settings ----
const saved = key => { try { return JSON.parse(localStorage.getItem(STORE + key)); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };
const SIZE_IDS = ['pw', 'ph', 'pkb', 'sw', 'sh', 'skb'];
const OPTION_IDS = [...SIZE_IDS, 'preset', 'mode', 'grows', 'gcols'];
const PRESETS = {             // photo w, h, KB, signature w, h, KB
  passport: [350, 450, 50, 300, 100, 20],
  small: [200, 230, 20, 140, 60, 10],
  large: [600, 800, 200, 600, 200, 50],
};
const rawOptions = () => Object.fromEntries(OPTION_IDS.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]));
function options() {
  save('options', rawOptions());
  const n = id => Math.max(1, parseInt($(id).value, 10) || 1), mode = $('mode').value;
  return { photo: [n('pw'), n('ph')], sign: [n('sw'), n('sh')], photoKB: n('pkb'), signKB: n('skb'),
           mode: mode === 'photos' ? 'photos' : 'grid', rows: mode === 'manual' ? n('grows') : 0, cols: mode === 'manual' ? n('gcols') : 0 };
}
function loadOptions() {
  const o = saved('options') || {};
  for (const id of OPTION_IDS) if (id in o) $(id).type === 'checkbox' ? $(id).checked = o[id] : $(id).value = o[id];
  showOptions();
}
function showOptions() { $('manual').hidden = $('mode').value !== 'manual'; }
$('preset').addEventListener('change', () => { const p = PRESETS[$('preset').value]; if (p) SIZE_IDS.forEach((id, i) => { $(id).value = p[i]; }); });
for (const id of SIZE_IDS) $(id).addEventListener('input', () => { $('preset').value = 'custom'; });
$('mode').addEventListener('change', showOptions);

// dialogs: [data-open=id] opens, [data-close] closes; changed settings re-run the sheets already loaded
let optionsBefore = '';
document.addEventListener('click', e => {
  const open = e.target.closest('[data-open]'), close = e.target.closest('[data-close]');
  if (open) { optionsBefore = JSON.stringify(rawOptions()); $(open.dataset.open).showModal(); }
  if (close) close.closest('dialog').close();
});
$('settings').addEventListener('close', () => {
  const changed = JSON.stringify(rawOptions()) !== optionsBefore;
  options();
  if (changed && files.length && !busy) process(files, true);
});

// ---- image worker ----
const worker = new Worker('worker.js');
const waiting = new Map();
let nextId = 1;
const workerReady = new Promise((resolve, reject) => {
  worker.addEventListener('message', ({ data }) => {
    if (data.type === 'ready') resolve();
    else if (data.type === 'fatal') reject(new Error(data.error));
    else if (data.type === 'page') { waiting.get(data.id)(data); waiting.delete(data.id); }
  });
  worker.addEventListener('error', e => reject(new Error(e.message || 'could not start')));
});
function scan(image, opts) {
  return new Promise(resolve => {
    const id = nextId++;
    waiting.set(id, resolve);
    worker.postMessage({ id, rgba: image.data.buffer, width: image.width, height: image.height, opts }, [image.data.buffer]);
  });
}

// ---- reading pages ----
function toImageData(source, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH; canvas.height = Math.round(h * PAGE_WIDTH / w);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
async function* pagesOf(file) {
  if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
    const bmp = await createImageBitmap(file);
    yield { total: 1, image: toImageData(bmp, bmp.width, bmp.height) };
    bmp.close();
    return;
  }
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n), base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width }), canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport }).promise;
    yield { total: pdf.numPages, image: ctx.getImageData(0, 0, canvas.width, canvas.height) };
    page.cleanup();
  }
  pdf.destroy();
}

// ---- processing ----
function progress(text, value, name = '') {
  $('progressText').textContent = text; $('progress').value = value;
  const n = students.length;
  $('progressNote').replaceChildren(name, document.createElement('br'), n ? `${n} ${n === 1 ? 'student' : 'students'} found so far` : '');
}
function problem(text) {
  for (const id of ['startErr', 'doneErr']) { $(id).textContent = text; $(id).hidden = !text; }
}
/* Process `batch`; with `fresh`, throw away current results first (settings changed). */
async function process(batch, fresh) {
  if (busy || !batch.length) return;
  busy = true;
  if (fresh) { students.length = 0; pagesDone = 0; $('rows').replaceChildren(); }
  else files.push(...batch);
  const opts = options(), problems = [];
  problem('');
  setState('working');
  progress('Getting ready…', 0);
  try {
    await workerReady;
    for (const [f, file] of batch.entries()) {
      let n = 0;
      const skipped = [];
      try {
        for await (const { total, image } of pagesOf(file)) {
          n++;
          progress(total > 1 ? `Reading page ${n} of ${total}` : 'Reading the sheet…', (f + (n - 1) / total) / batch.length, batch.length > 1 ? `${file.name} (file ${f + 1} of ${batch.length})` : file.name);
          const res = await scan(image, opts), page = ++pagesDone;
          console.debug(`${file.name} p${n}: ${res.ms} ms, layout ${res.layout}`);
          if (res.error) { skipped.push(n); continue; }
          for (const s of res.students) addStudent({ ...s, page, key: `${file.name}:${file.size}:${n}:${s.sr}` });
        }
      } catch (e) {
        problems.push(`Could not open ${file.name}.`);
      }
      if (skipped.length) problems.push(n === skipped.length
        ? `${file.name} does not look like a candidate sheet. If it is another kind of page with photos, open Settings and choose “No grid, just find photos”.`
        : `${file.name}: page${skipped.length > 1 ? 's' : ''} ${skipped.join(', ')} skipped, no sheet found there.`);
    }
  } catch (e) {
    problems.push(`Could not start (${e.message || e}). Try reloading the page.`);
  }
  busy = false;
  problem(problems.join(' '));
  setState(students.length ? 'done' : 'start');
  summarise();
}

// ---- tiles ----
const BADGE = { 'signature not found': 'No signature found', 'photo not found': 'No photo found',
                'photo crop doubtful': 'Check photo', 'photo edges unclear': 'Check photo',
                'photo file over the size limit': 'Photo file too big', 'signature file over the size limit': 'Signature file too big' };
/* A file the encoder could not get under the limit would be turned away by the portal, so say so. */
function checkSizes(s) {
  const limit = { photo: Math.max(1, parseInt($('pkb').value, 10) || 1), sign: Math.max(1, parseInt($('skb').value, 10) || 1) };
  for (const [kind, flag] of [['photo', 'photo file over the size limit'], ['sign', 'signature file over the size limit']]) {
    s.flags = s.flags.filter(f => f !== flag);
    if (s[kind] && s[kind].size > limit[kind] * 1000) s.flags.push(flag);
  }
  const kb = b => b ? Math.max(1, Math.round(b.size / 1000)) + ' KB' : 'none';
  s.el.num.textContent = `${s.id} · page ${s.page} · photo ${kb(s.photo)}, signature ${kb(s.sign)}`;
}
function paint(s) {
  const badges = [...new Set(s.flags.map(f => BADGE[f] || f))];
  s.el.badges.replaceChildren(...badges.map(b => Object.assign(document.createElement('span'), { className: 'badge', textContent: b })));
  s.flagged = s.flags.length > 0;            // something wrong with the files
  s.el.tile.classList.toggle('flag', s.flagged);
}

// ---- results ----
function addStudent(s) {
  s.id = String(students.length + 1).padStart(3, '0');
  s.flags = s.flags.filter(f => f !== 'name not written on form');     // names are not this page's business
  students.push(s);
  const el = (tag, cls) => Object.assign(document.createElement(tag), { className: cls || '' });
  const img = (blob, cls) => Object.assign(new Image(), { className: cls, src: URL.createObjectURL(blob), alt: '' });
  const tile = el('div', 'tile'), side = el('div', 'side'), namebox = el('div', 'namebox'), badges = el('div', 'badges');
  const num = el('span', 'num'), fix = kind => Object.assign(el('button', 'quiet fix'), { type: 'button', textContent: kind === 'photo' ? 'Adjust photo' : s.sign ? 'Adjust signature' : 'Add signature', onclick: () => adjust(s, kind) });
  const keep = kind => Object.assign(el('button', 'quiet fix'), { type: 'button', textContent: kind === 'photo' ? 'Save photo' : 'Save signature', onclick: () => s[kind] && download(s[kind], `${s.id}-${kind === 'photo' ? 'photo' : 'signature'}.jpg`) });
  const links = (...b) => { const d = el('div', 'links'); d.append(...b); return d; };
  const signImg = s.sign ? img(s.sign, 'sign') : null;
  if (signImg) { signImg.onclick = () => adjust(s, 'sign'); side.append(signImg); }
  side.append(num, badges);
  if (s.cell) side.append(links(fix('photo'), ...(s.name !== null ? [fix('sign')] : [])));
  s.el = { saveSign: keep('sign') };
  s.el.saveSign.hidden = !s.sign;
  side.append(links(...(s.photo ? [keep('photo')] : []), s.el.saveSign));
  if (s.name) namebox.append(img(s.name, 'strip'));
  const photoEl = s.photo ? img(s.photo, 'photo') : el('div', 'photo');
  if (s.cell) photoEl.onclick = () => adjust(s, 'photo');
  tile.append(photoEl, side, namebox);
  s.el = { ...s.el, tile, badges, num, photo: photoEl, sign: signImg, side };
  checkSizes(s);
  paint(s);
  const kept = saved('c:' + s.key);          // crops fixed by hand earlier, on this computer
  if (kept && s.cell) for (const kind of ['photo', 'sign']) if (kept[kind]) recrop(s, kind, kept[kind]);
  $('rows').appendChild(tile);
}
function summarise() {
  const flagged = students.filter(s => s.flagged).length, n = students.length;
  const note = flagged ? ['', `${flagged} with a problem`] : null;
  $('only').hidden = !flagged;
  if (!flagged) showOnly(false);
  $('sum').replaceChildren(`${n} ${n === 1 ? 'student' : 'students'} found`, ...(note ? [Object.assign(document.createElement('small'), { className: note[0], textContent: note[1] })] : []));
  $('zip').disabled = busy;
}

// ---- only the problems ----
function showOnly(on) { document.body.classList.toggle('only', on); $('only').setAttribute('aria-pressed', on); $('only').textContent = on ? 'Show everyone' : 'Show only problems'; }
$('only').addEventListener('click', () => showOnly(!document.body.classList.contains('only')));

// ---- adjusting a crop by hand ----
const CLEARS = { photo: ['photo crop doubtful', 'photo edges unclear', 'photo not found'], sign: ['signature not found'] };
const outSize = kind => (kind === 'photo' ? ['pw', 'ph', 'pkb'] : ['sw', 'sh', 'skb']).map(id => Math.max(1, parseInt($(id).value, 10) || 1));
/* Cut [x, y, w, h] out of the student's cell and make it the photo or signature, at the highest quality that fits the limit. */
async function recrop(s, kind, [x, y, w]) {
  const [ow, oh, kb] = outSize(kind), h = w * oh / ow, bmp = await createImageBitmap(s.cell), canvas = document.createElement('canvas');
  canvas.width = ow; canvas.height = oh;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ow, oh);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, x, y, w, h, 0, 0, ow, oh);
  bmp.close();
  let blob;
  for (let q = 0.95; q > 0.15; q -= 0.05) {
    blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', q));
    if (blob.size <= kb * 1000) break;
  }
  s[kind] = blob;
  s.flags = s.flags.filter(f => !CLEARS[kind].includes(f));
  let shown = s.el[kind];
  if (!shown || shown.tagName !== 'IMG') {       // there was no picture before: put one where it belongs
    const fresh = Object.assign(new Image(), { className: kind, alt: '', onclick: () => adjust(s, kind) });
    if (shown) shown.replaceWith(fresh); else s.el.side.prepend(fresh);
    shown = s.el[kind] = fresh;
    for (const b of s.el.side.querySelectorAll('.fix')) if (b.textContent === 'Add signature') b.textContent = 'Adjust signature';
    if (kind === 'sign') s.el.saveSign.hidden = false;
  }
  shown.src = URL.createObjectURL(blob);
  checkSizes(s);
  paint(s);
  summarise();
}
let adjusting = null;          // { s, kind, W, H, aspect, x, y, w } in the cell picture's own pixels
function placeBox() {
  const a = adjusting, k = $('adjImg').clientWidth / a.W, h = a.w / a.aspect;
  a.x = Math.min(Math.max(0, a.x), a.W - a.w); a.y = Math.min(Math.max(0, a.y), a.H - h);
  Object.assign($('cropbox').style, { left: a.x * k + 'px', top: a.y * k + 'px', width: a.w * k + 'px', height: h * k + 'px' });
}
async function adjust(s, kind) {
  const [ow, oh] = outSize(kind), aspect = ow / oh, picture = $('adjImg');
  picture.src = URL.createObjectURL(s.cell);
  await picture.decode();
  const W = picture.naturalWidth, H = picture.naturalHeight, widest = Math.min(W, H * aspect);
  const kept = (saved('c:' + s.key) || {})[kind];
  // start from the last hand-made crop, else what was found, else a sensible guess: the middle for a photo, the bottom for a signature
  let [x, y, w] = kept || (kind === 'photo' && s.crop ? [s.crop[0], s.crop[1], s.crop[2] - s.crop[0]] : null) || [0, 0, 0];
  if (!w) { w = widest * (kind === 'photo' ? 0.45 : 0.85); x = (W - w) / 2; y = kind === 'photo' ? (H - w / aspect) * 0.45 : H * 0.97 - w / aspect; }
  w = Math.min(w, widest);
  adjusting = { s, kind, W, H, aspect, x, y, w, widest };
  $('adjTitle').textContent = kind === 'photo' ? 'Adjust photo' : 'Adjust signature';
  $('adjSize').value = Math.round(w / widest * 100);
  $('adjust').showModal();
  placeBox();
}
$('adjSize').addEventListener('input', () => {
  const a = adjusting, w = a.widest * $('adjSize').value / 100, cx = a.x + a.w / 2, cy = a.y + a.w / a.aspect / 2;
  a.w = w; a.x = cx - w / 2; a.y = cy - w / a.aspect / 2;        // grow and shrink around the middle of the box
  placeBox();
});
$('cropbox').addEventListener('pointerdown', e => {
  const a = adjusting, k = a.W / $('adjImg').clientWidth, from = { px: e.clientX, py: e.clientY, x: a.x, y: a.y };
  $('cropbox').setPointerCapture(e.pointerId);
  const move = m => { a.x = from.x + (m.clientX - from.px) * k; a.y = from.y + (m.clientY - from.py) * k; placeBox(); };
  $('cropbox').addEventListener('pointermove', move);
  $('cropbox').addEventListener('pointerup', () => $('cropbox').removeEventListener('pointermove', move), { once: true });
});
$('adjApply').addEventListener('click', async () => {
  const a = adjusting, box = [a.x, a.y, a.w, a.w / a.aspect].map(Math.round);
  save('c:' + a.s.key, { ...saved('c:' + a.s.key), [a.kind]: box });
  $('adjust').close();
  await recrop(a.s, a.kind, box);
});

// ---- download ----
const fileKeys = () => students.map(s => s.id);
function csv(keys) {
  const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const rows = [['id', 'page', 'position', 'photo_file', 'sign_file', 'name_image', 'check']];
  students.forEach((s, i) => rows.push([s.id, s.page, s.sr,
    s.photo ? `photos/${keys[i]}.jpg` : '', s.sign ? `signs/${keys[i]}.jpg` : '', s.name ? `names/${keys[i]}.jpg` : '', s.flags.join('; ')]));
  return '﻿' + rows.map(r => r.map(v => q(String(v))).join(',')).join('\r\n') + '\r\n';
}
/* A page to open or print from the ZIP: every number beside its photo, signature and the name as written. */
function indexPage(keys) {
  const pic = (s, dir, key, w) => s ? `<img src="${dir}/${key}.jpg" style="width:${w}px">` : '';
  return `<!doctype html><meta charset="utf-8"><title>Photos and signatures</title>
<style>body{font:15px system-ui,sans-serif;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left;vertical-align:middle}tr{break-inside:avoid}img{display:block}</style>
<h1>Photos and signatures</h1><p>${students.length} students. Each row shows which numbered files belong to which student.</p>
<table><tr><th>File</th><th>Photo</th><th>Signature</th><th>Name on the sheet</th></tr>
${students.map((s, i) => `<tr><td><b>${keys[i]}</b><br>page ${s.page}</td><td>${pic(s.photo, 'photos', keys[i], 70)}</td><td>${pic(s.sign, 'signs', keys[i], 180)}</td><td>${pic(s.name, 'names', keys[i], 340)}</td></tr>`).join('\n')}
</table>`;
}
async function buildZip() {
  const keys = fileKeys(), text = t => new TextEncoder().encode(t);
  const out = [{ name: 'index.html', data: text(indexPage(keys)) }, { name: 'students.csv', data: text(csv(keys)) }];
  const bytes = async b => new Uint8Array(await b.arrayBuffer());
  for (const [i, s] of students.entries()) {
    if (s.photo) out.push({ name: `photos/${keys[i]}.jpg`, data: await bytes(s.photo) });
    if (s.sign) out.push({ name: `signs/${keys[i]}.jpg`, data: await bytes(s.sign) });
    if (s.name) out.push({ name: `names/${keys[i]}.jpg`, data: await bytes(s.name) });
  }
  return new Blob([makeZip(out)], { type: 'application/zip' });
}
function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
$('zip').addEventListener('click', async () => download(await buildZip(), 'photos-and-signatures.zip'));
$('reset').addEventListener('click', () => {
  const b = $('reset');
  if (!b.dataset.armed) {                      // two clicks instead of a browser dialog
    b.dataset.armed = '1'; b.textContent = 'Clear everything?';
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Start over'; }, 4000);
    return;
  }
  for (const k of Object.keys(localStorage)) if (k.startsWith(STORE + 's:') || k.startsWith(STORE + 'c:') || k === STORE + 'list') localStorage.removeItem(k);     // s: and list are left over from the version that kept names
  location.reload();
});

// ---- input ----
const picker = $('file');
$('pick').addEventListener('click', () => picker.click());
$('more').addEventListener('click', () => picker.click());
picker.addEventListener('change', () => { process([...picker.files]); picker.value = ''; });
let depth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); depth++; document.body.classList.add('over'); });
window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('over'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); depth = 0; document.body.classList.remove('over'); process([...e.dataTransfer.files]); });
loadOptions();

// ?src=<same-origin url> loads a file straight away (testing and demos); &mode= presets that option
const params = new URLSearchParams(location.search), src = params.get('src');
if (src) (async () => {
  const t0 = performance.now();
  if (params.get('mode')) { $('mode').value = params.get('mode'); showOptions(); }
  const b = await (await fetch(src)).blob();
  await process([new File([b], src.split('/').pop(), { type: b.type })]);
  window.formScan = { students, buildZip, csv: () => csv(fileKeys()), seconds: (performance.now() - t0) / 1000 };
  document.title = `done ${students.length}`;
})();
