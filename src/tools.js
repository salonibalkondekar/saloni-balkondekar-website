// Two tools for a mouse. On the page the cursor is a drafting crosshair: drag to pull a
// selection box, left to right for a window (takes what it fully encloses), right to left
// for a crossing (takes what it touches). Over the painting it is a dry brush dragged through
// wet paint: it smears the picture itself, pulling the colours under it along the stroke in
// streaks that thin out as they go. Once the hand rests, the paint settles back.
// Touch is left alone, and links, buttons and the painting's own click reactions keep working.
(function () {
    if (!matchMedia('(pointer: fine)').matches) return;
    const scene = document.getElementById('scene');
    const DPR = devicePixelRatio > 1 ? 2 : 1;
    const INK = '#16203a';

    // ---- cursors, drawn at the screen's pixel density so they stay sharp -------------------
    function cursor(el, size, hotspot, fallback, draw) {
        const c = document.createElement('canvas');
        c.width = c.height = size * DPR;
        const g = c.getContext('2d');
        g.scale(DPR, DPR);
        draw(g);
        const tail = `${hotspot} ${hotspot === 15 ? 15 : 30}, ${fallback}`;
        const url = `url(${c.toDataURL()})`;
        el.style.cursor = `image-set(${url} ${DPR}x) ${tail}`;
        if (!el.style.cursor) el.style.cursor = `-webkit-image-set(${url} ${DPR}x) ${tail}`;
        if (!el.style.cursor && DPR === 1) el.style.cursor = `${url} ${tail}`;      // else the stylesheet's cursor stays
    }
    // crosshair: hairlines that meet at the exact pixel under the hotspot, and a pickbox around it
    cursor(document.body, 31, 15, 'crosshair', g => {
        const cross = (grow, colour) => {
            g.fillStyle = colour;
            g.fillRect(15 - grow, 0, 1 + 2 * grow, 31);
            g.fillRect(0, 15 - grow, 31, 1 + 2 * grow);
            g.fillRect(11 - grow, 11 - grow, 9 + 2 * grow, 9 + 2 * grow);
        };
        cross(1, 'rgba(11, 16, 32, 0.5)');      // a dark edge, so it reads on a light surface too
        g.clearRect(12, 12, 7, 7);
        cross(0, '#fff');
        g.clearRect(12, 12, 7, 7);
        g.fillRect(15, 12, 1, 7);
        g.fillRect(12, 15, 7, 1);
    });
    // brush: a round sable, tip at the hotspot, bristles in the colour it is loaded with
    function brush(paint, far = paint) {
        if (!scene) return;
        cursor(scene, 32, 2, 'crosshair', g => {
            g.translate(2.5, 29.5);
            g.rotate(Math.PI / 4);
            g.lineJoin = g.lineCap = 'round';
            g.lineWidth = 1.1;
            g.strokeStyle = INK;
            const shape = (d, fill) => { const p = new Path2D(d); g.fillStyle = fill; g.fill(p); g.stroke(p); };
            shape('M-2 -13L-1 -34.6Q0 -36.8 1 -34.6L2 -13Z', '#e2a85a');                                  // tapered wooden handle
            shape('M-2.5 -13.6h5v5.4h-5z', '#dfe5ee');                                                    // ferrule
            const wet = g.createLinearGradient(-2.5, 0, 2.5, 0);
            wet.addColorStop(0.15, paint); wet.addColorStop(0.85, far);
            shape('M-2.5 -8.4C-3.5 -5.6 -1.5 -2.6 0 0C1.5 -2.6 3.5 -5.6 2.5 -8.4Z', wet);                 // bristles, loaded with what they last picked up
            g.fillStyle = 'rgba(22, 32, 58, 0.35)';
            g.fillRect(-2.5, -11.4, 5, 0.9);                                                              // crimp on the ferrule
        });
    }
    brush('#fbf7ee');

    const isMouse = e => e.pointerType === 'mouse' && e.button === 0;

    // ---- selection box ---------------------------------------------------------------------
    const PICKABLE = '.left-section h1, .left-section h2, .left-section p, .left-section li, .left-section .button-link';
    const layer = document.createElement('div');        // holds the grips, in page coordinates
    layer.className = 'cad-layer';
    const box = document.createElement('div');
    box.className = 'cad-box';
    const note = document.createElement('div');
    note.className = 'cad-note';
    document.body.append(layer, box, note);
    let picked = new Set(), from = null, held = null, dragging = false;

    function show() {
        layer.replaceChildren(...[...picked].map(el => {
            const r = el.getBoundingClientRect(), mark = document.createElement('div');
            mark.className = 'cad-pick';
            mark.style.cssText = `left:${r.left + scrollX - 4}px;top:${r.top + scrollY - 3}px;width:${r.width + 8}px;height:${r.height + 6}px`;
            mark.innerHTML = '<i></i><i></i><i></i><i></i>';
            return mark;
        }));
    }
    function clear() { picked = new Set(); show(); }

    addEventListener('pointerdown', e => {
        if (!isMouse(e) || !e.target.closest || e.target.closest('a, button, .scene')) return;
        from = { x: e.clientX, y: e.clientY };
        dragging = false;
        held = e.shiftKey ? new Set(picked) : new Set();        // shift adds to what is already selected
    });
    addEventListener('pointermove', e => {
        if (!from) return;
        const x = e.clientX, y = e.clientY;
        if (!dragging && Math.hypot(x - from.x, y - from.y) < 4) return;
        if (!dragging) {
            dragging = true;
            document.body.classList.add('cad-drag');
            getSelection().removeAllRanges();
        }
        const crossing = x < from.x;
        const l = Math.min(x, from.x), t = Math.min(y, from.y), r = Math.max(x, from.x), b = Math.max(y, from.y);
        box.className = 'cad-box on ' + (crossing ? 'crossing' : 'window');
        box.style.cssText = `left:${l}px;top:${t}px;width:${r - l}px;height:${b - t}px`;
        picked = new Set(held);
        document.querySelectorAll(PICKABLE).forEach(el => {
            const q = el.getBoundingClientRect();
            const hit = crossing ? q.left < r && q.right > l && q.top < b && q.bottom > t
                : q.left >= l && q.right <= r && q.top >= t && q.bottom <= b;
            if (hit) picked.add(el);
        });
        show();
    });
    addEventListener('pointerup', e => {
        if (!from) return;
        if (!dragging) clear();     // a plain click on empty space lets go of everything
        else {
            note.textContent = picked.size + ' found';
            note.style.cssText = `left:${e.clientX + 14}px;top:${e.clientY + 14}px`;
            note.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1400 });
        }
        from = null;
        dragging = false;
        box.className = 'cad-box';
        document.body.classList.remove('cad-drag');
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') clear(); });
    addEventListener('resize', clear);

    // ---- the smudge brush -------------------------------------------------------------------
    if (!scene) return;
    const NS = 'http://www.w3.org/2000/svg';
    // RADIUS is the brush's reach in painting units. CARRY is how much of its load the brush keeps
    // from one dab to the next: higher pulls colour further. STEP is the gap between dabs, and
    // HOLD is how long the smear stays once the hand rests.
    const RADIUS = 13, CARRY = 0.9, STEP = 1.5, HOLD = 1500;
    let stroke = null, painted = false, rest = 0;

    // The colour under the tip, as the eye sees it: the nearest solid fill, or the sky's own
    // blue at that height. A shape painted thin (the pale streaks in the sky are about half
    // opacity) is mixed with the sky behind it by that opacity, not read as its raw colour.
    const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const mix = (a, b, k) => '#' + hex(a).map((v, j) => Math.round(v + (hex(b)[j] - v) * k).toString(16).padStart(2, '0')).join('');
    // a vertical gradient read at height y: blend the two stops either side of it
    function ramped(ramp, y) {
        const y1 = +ramp.getAttribute('y1'), t = (y - y1) / (ramp.getAttribute('y2') - y1);
        const stops = [...ramp.querySelectorAll('stop')].map(n => [+n.getAttribute('offset'), n.getAttribute('stop-color')]);
        const found = stops.findIndex(n => n[0] >= t), i = Math.max(1, found < 0 ? stops.length - 1 : found);
        const [a, b] = [stops[i - 1], stops[i]];
        return mix(a[1], b[1], Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0] || 1))));
    }
    const rampOf = c => c && c.startsWith('url(') && scene.querySelector(c.slice(4, -1));
    function dip(node, y) {
        for (; node && node !== scene; node = node.parentNode) {
            const c = node.getAttribute && (node.getAttribute('fill') || node.getAttribute('stroke'));
            if (c && c[0] === '#' && c.length === 7) {
                const thin = +node.getAttribute('opacity') || 1;
                const behind = thin < 1 && node.ownerSVGElement.querySelector('rect[fill^="url("]');
                const ramp = behind && rampOf(behind.getAttribute('fill'));
                return ramp ? mix(ramped(ramp, y), c, thin) : c;
            }
            const ramp = rampOf(c);
            if (ramp && ramp.hasAttribute('y1')) return ramped(ramp, y);
        }
        return '#fbf7ee';
    }
    // A true colour picker: the painting is drawn once into two small off-screen bitmaps, the
    // clouds on their own (they drift while the painting is hovered) and everything else, and the
    // brush reads the pixel under it. Things that move or change (plane, train, sun) and any
    // failure to draw the bitmaps fall back to reading the shape's own fill with dip().
    const K = 1, PW = 816, PH = 1488;
    let pix = null, drift = 0;
    function shoot(root, cloudsOnly) {
        const copy = root.cloneNode(true);
        copy.setAttribute('xmlns', NS);
        copy.setAttribute('width', PW);
        copy.setAttribute('height', PH);
        // what the stylesheet hides or moves is not part of the still picture
        copy.querySelectorAll(':scope > rect, .veil, .stars, .lights, .smear, .moonface, .steam, .smoke, .plane, [data-act=train]').forEach(n => n.remove());
        copy.querySelectorAll('svg').forEach(n => n.removeAttribute('style'));
        const cloudLayer = copy.querySelector('.home-painting-clouds');
        if (cloudsOnly) [...copy.children].forEach(n => { if (n !== cloudLayer) n.remove(); });
        else cloudLayer.remove();
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
        const img = new Image();
        img.src = url;
        return img.decode().then(() => {
            const c = document.createElement('canvas');
            c.width = PW; c.height = PH;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.drawImage(img, 0, 0, PW, PH);
            URL.revokeObjectURL(url);
            return g.getImageData(0, 0, PW, PH).data;
        });
    }
    function develop() {
        const root = scene.querySelector('svg');
        if (root) Promise.all([shoot(root, false), shoot(root, true)]).then(([base, cloud]) => { pix = { base, cloud }; }).catch(() => { pix = null; });
    }
    if (scene.querySelector('svg')) develop(); else document.addEventListener('scene:ready', develop);
    const read = (data, x, y) => {
        const i = (Math.min(PH - 1, Math.max(0, Math.round(y * K))) * PW + Math.min(PW - 1, Math.max(0, Math.round(x * K)))) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    // the colour at a point of the painting (in its own units), under whatever `node` is there
    function pick(node, x, y) {
        if (!pix || (node && node.closest && node.closest('[data-act=plane], [data-act=train], [data-act=sun]'))) return dip(node, y);
        const c = read(pix.cloud, x - drift, y), [r, g, b] = c[3] > 127 ? c : read(pix.base, x, y);
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    function at(root, e) {
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(root.getScreenCTM().inverse());
        return [p.x, p.y];
    }

    // The smear is real: a bitmap the size of the painting, laid over it under the night veil and
    // the paper grain. `seen` is the picture as it stands (the painting, plus whatever has been
    // smeared so far), filled in from the two still bitmaps only where the brush goes. The brush
    // holds a small round bitmap of its own. At every dab the load and the picture under it are
    // mixed, mostly load, and the result is both laid down and kept as the new load. So colour is
    // carried along and thins with distance, and each bristle keeps its own lane.
    const D = RADIUS * 2 + 1;
    const soft = new Float32Array(D * D);       // how hard each bristle presses: full in the middle, nothing at the rim
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
        const d = Math.hypot(i - RADIUS, j - RADIUS) / RADIUS, t = Math.max(0, Math.min(1, (1 - d) / 0.45));
        // dry bristles: some lanes carry less, which leaves streaks along the stroke
        soft[j * D + i] = t * t * (3 - 2 * t) * (0.62 + 0.38 * Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1));
    }
    let film = null, ink = null, out = null, seen = null, known = null, load = null, fade = null, wet = false;
    function canvas(root) {
        if (film) return;
        film = document.createElementNS(NS, 'foreignObject');
        film.setAttribute('class', 'smear');
        film.setAttribute('width', PW);
        film.setAttribute('height', PH);
        const c = document.createElement('canvas');
        c.width = PW; c.height = PH;
        film.appendChild(c);
        ink = c.getContext('2d');
        out = ink.createImageData(PW, PH);
        seen = new Float32Array(PW * PH * 3);
        known = new Uint8Array(PW * PH);
        load = new Float32Array(D * D * 3);
        root.insertBefore(film, root.querySelector('.veil').parentNode);
    }
    // the picture at a pixel, looked up the first time the brush gets there
    function look(p) {
        if (known[p]) return;
        known[p] = 1;
        const x = p % PW, y = (p - x) / PW;
        const cx = Math.round(x - drift), c = cx >= 0 && cx < PW ? cx + y * PW : -1;
        const from = c >= 0 && pix.cloud[c * 4 + 3] > 127 ? pix.cloud : pix.base, q = (from === pix.cloud ? c : p) * 4;
        seen[p * 3] = from[q]; seen[p * 3 + 1] = from[q + 1]; seen[p * 3 + 2] = from[q + 2];
    }
    // one press of the brush at (x, y); `first` only loads it
    function dab(x, y, first) {
        const x0 = Math.round(x) - RADIUS, y0 = Math.round(y) - RADIUS, o = out.data;
        for (let j = 0; j < D; j++) {
            const py = y0 + j;
            if (py < 0 || py >= PH) continue;
            for (let i = 0; i < D; i++) {
                const px = x0 + i, m = soft[j * D + i];
                if (!m || px < 0 || px >= PW) continue;
                const p = py * PW + px, b = (j * D + i) * 3, q = p * 3;
                look(p);
                if (first) { load[b] = seen[q]; load[b + 1] = seen[q + 1]; load[b + 2] = seen[q + 2]; continue; }
                for (let ch = 0; ch < 3; ch++) {
                    load[b + ch] = load[b + ch] * CARRY + seen[q + ch] * (1 - CARRY);
                    seen[q + ch] += (load[b + ch] - seen[q + ch]) * m;
                    o[p * 4 + ch] = seen[q + ch];
                }
                o[p * 4 + 3] = Math.max(o[p * 4 + 3], Math.min(255, m * 420));
            }
        }
    }
    // dabs laid evenly along the line from the last sample to this one, then the touched part redrawn
    function drag(s, x, y) {
        const dx = x - s.x, dy = y - s.y, far = Math.hypot(dx, dy);
        if (far < STEP) return;
        for (let t = STEP; t <= far; t += STEP) dab(s.x + dx / far * t, s.y + dy / far * t, false);
        const l = Math.max(0, Math.floor(Math.min(s.x, x)) - RADIUS - 1), t = Math.max(0, Math.floor(Math.min(s.y, y)) - RADIUS - 1);
        ink.putImageData(out, 0, 0, l, t, Math.abs(dx) + D + 3, Math.abs(dy) + D + 3);
        const done = Math.floor(far / STEP) * STEP;
        s.x += dx / far * done; s.y += dy / far * done;
    }
    // the paint settles: the smear dissolves and the picture is whole again
    function settle() {
        fade = film.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1100, easing: 'ease-in-out' });
        fade.onfinish = () => {
            fade = null;
            wet = false;
            out.data.fill(0);
            known.fill(0);
            ink.clearRect(0, 0, PW, PH);
        };
    }

    scene.addEventListener('pointerdown', e => {
        const root = scene.querySelector('svg');
        if (!isMouse(e) || !root || stroke) return;
        e.preventDefault();
        clearTimeout(rest);     // still painting: what is on the canvas stays
        const [x, y] = at(root, e);
        // how far the clouds have drifted, so the still bitmap of them lines up; fixed while a smear is on the canvas
        const sky = root.querySelector('.home-painting-clouds');
        if (!wet) drift = sky ? new DOMMatrix(getComputedStyle(sky).transform).m41 : 0;
        brush(pick(e.target, x, y));
        stroke = { root, x, y, moved: false, cx: e.clientX, cy: e.clientY, id: e.pointerId };
    });
    addEventListener('pointermove', e => {
        const s = stroke;
        if (!s || e.pointerId !== s.id) return;
        if (!s.moved) {
            if (Math.hypot(e.clientX - s.cx, e.clientY - s.cy) < 4 || !pix) return;      // a click, not a stroke
            s.moved = true;
            canvas(s.root);
            if (fade) { fade.onfinish = null; fade.cancel(); fade = null; }      // a smear already fading comes back
            wet = true;
            dab(s.x, s.y, true);
        }
        // every sample the mouse reported since the last frame, not just the latest
        (e.getCoalescedEvents ? e.getCoalescedEvents() : []).concat(e).forEach(m => drag(s, ...at(s.root, m)));
    });
    function finish(e) {
        const s = stroke;
        if (!s || (e.pointerId !== undefined && e.pointerId !== s.id)) return;
        stroke = null;
        if (!s.moved) return;
        painted = true;
        setTimeout(() => { painted = false; });
        clearTimeout(rest);
        rest = setTimeout(settle, HOLD);
    }
    addEventListener('pointerup', finish);
    addEventListener('pointercancel', finish);
    addEventListener('blur', finish);       // the button was let go outside the window
    // the end of a stroke is not a click on whatever lies under it
    addEventListener('click', e => { if (painted) e.stopPropagation(); }, true);
})();
