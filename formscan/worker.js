/* Background worker: loads OpenCV + the face model once, then turns page pixels into JPEG crops. */
importScripts('vendor/opencv.js', 'core.js');

const ready = new Promise((resolve, reject) => {
  const start = async () => {
    try {
      const model = new Uint8Array(await (await fetch('yunet.onnx')).arrayBuffer());
      resolve(FormScan.createScanner(cv, model));
    } catch (e) { reject(e); }
  };
  if (cv.Mat) start(); else cv.onRuntimeInitialized = start;
});
ready.then(() => postMessage({ type: 'ready' }), e => postMessage({ type: 'fatal', error: String(e && e.message || e) }));

/* Highest JPEG quality that fits in maxBytes. */
async function jpeg(im, maxBytes) {
  const canvas = new OffscreenCanvas(im.w, im.h);
  canvas.getContext('2d').putImageData(new ImageData(im.data, im.w, im.h), 0, 0);
  let blob;
  for (let q = 0.95; q > 0.15; q -= 0.05) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
    if (blob.size <= maxBytes) break;
  }
  return blob;
}

onmessage = async ({ data: { id, rgba, width, height, opts } }) => {
  try {
    const scanner = await ready, t0 = performance.now();
    const { students, layout } = scanner.scanPage(new Uint8Array(rgba), width, height, opts);
    const scanMs = Math.round(performance.now() - t0);
    const out = [];
    for (const s of students) out.push({
      sr: s.sr, flags: s.flags, notes: s.notes,
      photo: s.photo && await jpeg(s.photo, opts.photoKB * 1000),
      sign: s.sign && await jpeg(s.sign, opts.signKB * 1000),
      name: s.name && await jpeg(s.name, 60000),
      cell: s.cell && await jpeg(s.cell, 400000), crop: s.crop,
    });
    postMessage({ type: 'page', id, students: out, layout, ms: Math.round(performance.now() - t0), scanMs });
  } catch (e) {
    // OpenCV.js throws raw pointers for C++ exceptions
    const msg = typeof e === 'number' ? 'image processing failed' : String(e && e.message || e);
    postMessage({ type: 'page', id, error: msg });
  }
};
