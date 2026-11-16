import * as pdfjs from './vendor/pdf.min.mjs';
import { makeZip } from './zip.js';
import { readName, parseList, matchNames } from './names.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const PAGE_WIDTH = 2200;                    // px a page is rendered at before processing
const STORE = 'formscan:v1:';               // localStorage prefix: options, class list, typed names
const $ = id => document.getElementById(id);
const students = [], files = [];            // people found, in page order; every file added so far
let pagesDone = 0, busy = false, list = [], run = 0;
const setState = s => { document.body.dataset.state = s; };

// ---- settings ----
const saved = key => { try { return JSON.parse(localStorage.getItem(STORE + key)); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };
const SIZE_IDS = ['pw', 'ph', 'pkb', 'sw', 'sh', 'skb'];
const OPTION_IDS = [...SIZE_IDS, 'preset', 'naming', 'mode', 'grows', 'gcols', 'read'];
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
  $('list').value = saved('list') || '';
  list = parseList($('list').value);
  showOptions();
}
function showOptions() {
  $('manual').hidden = $('mode').value !== 'manual';
  $('listBtn').textContent = list.length ? `Class list (${list.length})` : 'Add class list';
}
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
$('listbox').addEventListener('close', showOptions);
$('list').addEventListener('input', () => { save('list', $('list').value); list = parseList($('list').value); applyNames(); });

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
function progress(text, value) { $('progressText').textContent = text; $('progress').value = value; }
function problem(text) {
  for (const id of ['startErr', 'doneErr']) { $(id).textContent = text; $(id).hidden = !text; }
}
/* Process `batch`; with `fresh`, throw away current results first (settings changed). */
async function process(batch, fresh) {
  if (busy || !batch.length) return;
  busy = true;
  const mine = ++run;
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
          progress(total > 1 ? `Page ${n} of ${total}` : 'Working on it…', (f + (n - 1) / total) / batch.length);
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
  await nameQueue;
  if (mine === run) summarise();
}

// ---- names ----
let nameQueue = Promise.resolve(), namesLeft = 0;
function queueReading(s) {
  namesLeft++;
  const mine = run;
  nameQueue = nameQueue.then(async () => {
    if (mine === run) { try { s.reading = await readName(s.hand); } catch (e) { console.warn('name reader:', e.message || e); } }
    namesLeft--;
    if (mine === run) applyNames();
  });
}
/* Fill names nobody has typed: from the class list when there is one, else the raw reading as a draft. */
function applyNames() {
  const open = students.filter(s => s.status !== 'typed');
  const typed = new Set(students.filter(s => s.status === 'typed').map(s => s.fields.name));
  const free = list.map((l, i) => ({ ...l, i })).filter(l => !typed.has(l.name));
  const picks = free.length ? matchNames(open.map(s => s.reading), free) : [];
  open.forEach((s, k) => {
    const pick = picks[k];
    if (pick) { s.fields.name = free[pick.index].name; s.listRow = free[pick.index].i; s.status = pick.sure ? 'matched' : 'check'; }
    else if (!list.length && s.reading) { s.fields.name = s.reading; s.listRow = null; s.status = 'draft'; }
    else { s.fields.name = ''; s.listRow = null; s.status = ''; }
    paint(s);
  });
  for (const s of students) if (s.status === 'typed') s.listRow = list.findIndex(l => l.name === s.fields.name);
  $('names').replaceChildren(...list.map(l => new Option(l.name)));
  summarise();
}
const BADGE = { 'name not written on form': 'No name on sheet', 'signature not found': 'No signature found', 'photo not found': 'No photo found',
                'photo crop doubtful': 'Check photo', 'photo edges unclear': 'Check photo' };
function paint(s) {
  const unsure = s.status === 'check' || s.status === 'draft';
  const badges = [...new Set(s.flags.map(f => BADGE[f] || f))];
  if (unsure) badges.unshift('Check name');
  if (document.activeElement !== s.el.name) s.el.name.value = s.fields.name;
  s.el.name.classList.toggle('unsure', unsure);
  s.el.badges.replaceChildren(...badges.map(b => Object.assign(document.createElement('span'), { className: 'badge', textContent: b })));
  s.flagged = badges.length > 0;
  s.el.tile.classList.toggle('flag', s.flagged);
}

// ---- results ----
function addStudent(s) {
  s.id = String(students.length + 1).padStart(3, '0');
  s.fields = saved('s:' + s.key) || { name: '' };
  s.status = s.fields.name ? 'typed' : ''; s.reading = ''; s.listRow = null;
  students.push(s);
  const el = (tag, cls) => Object.assign(document.createElement(tag), { className: cls || '' });
  const img = (blob, cls) => Object.assign(new Image(), { className: cls, src: URL.createObjectURL(blob), alt: '' });
  const tile = el('div', 'tile'), side = el('div', 'side'), namebox = el('div', 'namebox'), badges = el('div', 'badges');
  const name = Object.assign(el('input'), { placeholder: 'Student name', autocomplete: 'off', value: s.fields.name });
  name.setAttribute('list', 'names');
  const commit = () => { s.fields.name = name.value.trim(); s.status = 'typed'; s.listRow = list.findIndex(l => l.name === s.fields.name); save('s:' + s.key, s.fields); paint(s); summarise(); };
  name.addEventListener('input', commit);
  name.addEventListener('keydown', e => { if (e.key === 'Enter' && name.value.trim()) { commit(); name.blur(); } });   // Enter accepts a suggestion as it stands
  if (s.sign) side.append(img(s.sign, 'sign'));
  side.append(Object.assign(el('span', 'num'), { textContent: `${s.id} · page ${s.page}` }), badges);
  if (s.name) namebox.append(img(s.name, 'strip'));
  namebox.append(name);
  tile.append(s.photo ? img(s.photo, 'photo') : el('div', 'photo'), side, namebox);
  s.el = { tile, name, badges };
  paint(s);
  $('rows').appendChild(tile);
  if (s.hand && $('read').checked && s.status !== 'typed') queueReading(s);
}
function summarise() {
  const flagged = students.filter(s => s.flagged).length, n = students.length;
  const note = namesLeft ? ['busy', 'reading names…'] : flagged ? ['', `${flagged} to check`] : null;
  $('sum').replaceChildren(`${n} ${n === 1 ? 'student' : 'students'} found`, ...(note ? [Object.assign(document.createElement('small'), { className: note[0], textContent: note[1] })] : []));
  $('zip').disabled = busy;
}

// ---- download ----
function fileKeys() {
  const byName = $('naming').value === 'name', used = new Set();
  return students.map(s => {
    let key = ((byName && s.fields.name) || s.id).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || s.id;
    if (used.has(key.toLowerCase())) key += '_' + s.id;
    used.add(key.toLowerCase());
    return key;
  });
}
function csv(keys) {
  const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const extra = Math.max(0, ...list.map(l => l.cells.length));
  const rows = [['id', 'page', 'position', 'name', 'name_source', 'photo_file', 'sign_file', 'name_image', 'check', ...Array.from({ length: extra }, (_, i) => `list_${i + 1}`)]];
  students.forEach((s, i) => rows.push([s.id, s.page, s.sr, s.fields.name, s.status,
    s.photo ? `photos/${keys[i]}.jpg` : '', s.sign ? `signs/${keys[i]}.jpg` : '', s.name ? `names/${keys[i]}.jpg` : '', s.flags.join('; '),
    ...(s.listRow != null && list[s.listRow] ? list[s.listRow].cells : [])]));
  return '﻿' + rows.map(r => r.map(v => q(String(v))).join(',')).join('\r\n') + '\r\n';
}
async function buildZip() {
  const keys = fileKeys(), out = [{ name: 'students.csv', data: new TextEncoder().encode(csv(keys)) }];
  const bytes = async b => new Uint8Array(await b.arrayBuffer());
  for (const [i, s] of students.entries()) {
    if (s.photo) out.push({ name: `photos/${keys[i]}.jpg`, data: await bytes(s.photo) });
    if (s.sign) out.push({ name: `signs/${keys[i]}.jpg`, data: await bytes(s.sign) });
    if (s.name) out.push({ name: `names/${keys[i]}.jpg`, data: await bytes(s.name) });
  }
  return new Blob([makeZip(out)], { type: 'application/zip' });
}
$('zip').addEventListener('click', async () => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await buildZip()), download: 'photos-and-signatures.zip' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});
$('reset').addEventListener('click', () => {
  const b = $('reset');
  if (!b.dataset.armed) {                      // two clicks instead of a browser dialog
    b.dataset.armed = '1'; b.textContent = 'Clear everything?';
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Start over'; }, 4000);
    return;
  }
  for (const k of Object.keys(localStorage)) if (k.startsWith(STORE + 's:') || k === STORE + 'list') localStorage.removeItem(k);
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

// ?src=<same-origin url> loads a file straight away (testing and demos); &mode= and &list=<url> preset those options
const params = new URLSearchParams(location.search), src = params.get('src');
if (src) (async () => {
  const t0 = performance.now();
  if (params.get('mode')) { $('mode').value = params.get('mode'); showOptions(); }
  if (params.get('list')) { $('list').value = await (await fetch(params.get('list'))).text(); list = parseList($('list').value); showOptions(); }
  const b = await (await fetch(src)).blob();
  await process([new File([b], src.split('/').pop(), { type: b.type })]);
  window.formScan = { students, buildZip, csv: () => csv(fileKeys()), seconds: (performance.now() - t0) / 1000 };
  document.title = `done ${students.length}`;
})();
