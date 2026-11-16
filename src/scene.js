// The painting. painting.svg is the hand-drawn base: sky, clouds, two towns, bushes,
// the hill and the wheat. This script loads it inline, takes out the landmark buildings
// and paints a supply chain in their place: a container port above, silos, a factory and
// a freight line below. Tap the sun for night. Click reactions live in play.js.
(async function () {
    const el = document.getElementById('scene');
    if (!el) return;
    const src = new URL('painting.svg', document.currentScript.src);

    let seed = 23;
    const rnd = () => {
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const R = (a, b) => a + rnd() * (b - a);
    const f = n => Math.round(n * 10) / 10;
    // colours sampled from the base painting
    const C = {
        navy: '#1b3249', slate: '#3d5a80', red: '#e3292e', yellow: '#f3b72f', orange: '#ee8b2a', cream: '#fbf7ee',
        shade: '#efe7d8', blue: '#1f78b6', lblue: '#a9d8ea', teal: '#11876f', green: '#4f9442', sea: '#2d7fc1', brown: '#8b5a34'
    };
    // container colours; the petal burst in play.js uses the same set
    const PAL = ['#6f5bb0', '#fb8ca5', C.red, C.orange, C.yellow, C.green, C.teal, C.blue];
    el.dataset.pal = PAL.join(' ');
    // painted containers keep to four of them, so the port stays calm
    const pal = () => [2, 4, 7, 6][Math.floor(rnd() * 4)];

    const P = (x, y) => f(x) + ' ' + f(y);
    const path = (d, fill, extra = '') => `<path d="${d}"${fill ? ` fill="${fill}"` : ''}${extra}/>`;
    const line = (d, stroke, sw, extra = '') => `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="none"${extra}/>`;
    const dot = (x, y, r, fill, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${extra}/>`;
    // nothing is ruled: corners are nudged and edges bowed by a hair
    function smooth(pts) {
        const n = pts.length, mid = i => P((pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2);
        return 'M' + mid(n - 1) + pts.map((p, i) => 'Q' + P(p[0], p[1]) + ' ' + mid(i)).join('') + 'Z';
    }
    function cut(pts, j = 0.7) {
        const q = pts.map(([x, y]) => [x + R(-j, j), y + R(-j, j)]);
        return 'M' + P(q[0][0], q[0][1]) + q.map((a, i) => {
            const b = q[(i + 1) % q.length];
            return 'Q' + P((a[0] + b[0]) / 2 + R(-j, j), (a[1] + b[1]) / 2 + R(-j, j)) + ' ' + P(b[0], b[1]);
        }).join('') + 'Z';
    }
    const rect = (x, y, w, h, fill, extra = '') => path(cut([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Math.min(0.7, Math.min(w, h) * 0.07)), fill, extra);
    function dab(x, y, L, ang, w) {
        const c = Math.cos(ang), s = Math.sin(ang), mx = x + c * L / 2, my = y + s * L / 2;
        return `M${P(x, y)}Q${P(mx - s * w, my + c * w)} ${P(x + c * L, y + s * L)}Q${P(mx + s * w * 0.3, my - c * w * 0.3)} ${P(x, y)}Z`;
    }
    // flecks of paint, light and dark, the same tooth the base painting has
    function fleck(n, x0, y0, x1, y1) {
        let a = '', b = '';
        for (let i = 0; i < n; i++) {
            const r = R(0.5, 1.2), s = `M${P(R(x0, x1), R(y0, y1))}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
            if (i % 3) a += s; else b += s;
        }
        return path(a, '#fff', ' opacity=".4" pointer-events="none"') + path(b, '#2a1c10', ' opacity=".14" pointer-events="none"');
    }
    const crate = (x, y, i, w = 26, h = 12) =>
        `<rect class="crate" data-i="${i}" x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="1.5" fill="${PAL[i]}"/>` +
        `<path d="M${f(x + w / 3)} ${f(y + 2)}v${h - 4}M${f(x + 2 * w / 3)} ${f(y + 2)}v${h - 4}" stroke="rgba(0,0,0,.16)" stroke-width="1" pointer-events="none"/>`;

    // ---- load the base and take out what we replace --------------------------
    el.innerHTML = await (await fetch(src)).text();
    const root = el.querySelector('svg');
    root.querySelectorAll(':scope > style, :scope > title').forEach(n => n.remove());
    const [sky, clouds, city, fore] = [...root.children].filter(n => n.tagName === 'svg');
    const texture = root.querySelector(':scope > rect');
    // The paper grain is two noise layers over the whole picture: a brown grain multiplied in, and a pale
    // speckle. Inside the SVG, a blended layer over a moving picture is composited again on every frame,
    // which made the painting stutter on phones (the multiply alone cost a third of the frame rate in iOS
    // Safari). So both layers are painted once into one canvas laid over the painting, with no blend mode,
    // and only then are the copies in the SVG switched off. If the canvas cannot be painted, they stay.
    //
    // Multiplying by a colour c at strength a darkens what is under it to B(1 - a(1 - c)). Painting a dark
    // colour k over it at strength a*s gives B(1 - a*s) + a*s*k, the same thing when k = B(1 - (1 - c)/s).
    // That depends on B, so k is worked out for a typical bright tone of the painting (MID). Measured against
    // the SVG's own grain in iOS Safari and Chrome: average colour within 0.2 of a level in 255, contrast
    // within 0.2%, fine detail within 4%.
    const MID = 0.75;
    const grainCanvas = Object.assign(document.createElement('canvas'), { className: 'grain' });
    const grains = [...root.querySelectorAll(':scope > rect[filter]')].map(rect => {
        const id = rect.getAttribute('filter').slice(4, -1), filter = root.querySelector(id);
        const g = { rect, id, filter: new XMLSerializer().serializeToString(filter), alpha: +rect.getAttribute('opacity') || 1, tint: null };
        if (rect.style.mixBlendMode === 'multiply') {
            // the filter's colour is written in linear light; this is what it comes to on screen, used if the painted sheet cannot be read
            const m = filter.querySelector('feColorMatrix').getAttribute('values').trim().split(/\s+/).map(Number);
            g.tint = [m[4], m[9], m[14]].map(v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
        }
        return g;
    });
    let grainTimer = 0;
    async function paintGrain() {
        // painted at the screen's own pixel density, as the SVG's filters are
        const box = el.getBoundingClientRect(), k = Math.min(devicePixelRatio || 1, 3);
        const w = Math.round(box.width * k), h = Math.round(box.height * k);
        if (!w || !h || !grains.length) return;
        try {
            const sheets = await Promise.all(grains.map(async g => {
                // the same viewBox and fit as the painting, so the grain lands where it always did
                const svg = `<svg xmlns="${root.namespaceURI}" width="${w}" height="${h}" viewBox="${root.getAttribute('viewBox')}" preserveAspectRatio="${root.getAttribute('preserveAspectRatio')}">` +
                    `${g.filter}<rect width="${g.rect.getAttribute('width')}" height="${g.rect.getAttribute('height')}" filter="url(${g.id})"/></svg>`;
                const img = new Image();
                img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
                await img.decode();
                const sheet = Object.assign(document.createElement('canvas'), { width: w, height: h }), ctx = sheet.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                if (g.tint) {
                    let c = g.tint;
                    try {       // the colour the browser actually gave the layer: average of its solid pixels
                        const px = ctx.getImageData(0, 0, Math.min(w, 200), Math.min(h, 200)).data, sum = [0, 0, 0];
                        let n = 0;
                        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) { sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; n++; }
                        if (n > 50) c = sum.map(v => v / n / 255);
                    } catch (e) { /* keep the computed colour */ }
                    const s = 1 - Math.min(...c);
                    ctx.globalCompositeOperation = 'source-in';       // keep the noise's shape, change its colour
                    ctx.fillStyle = `rgb(${c.map(v => Math.round(255 * MID * (1 - (1 - v) / s))).join(' ')})`;
                    ctx.fillRect(0, 0, w, h);
                    sheet.strength = s;
                }
                return sheet;
            }));
            grainCanvas.width = w; grainCanvas.height = h;
            const ctx = grainCanvas.getContext('2d');
            sheets.forEach((sheet, i) => { ctx.globalAlpha = grains[i].alpha * (sheet.strength || 1); ctx.drawImage(sheet, 0, 0); });
            if (!grainCanvas.isConnected) el.appendChild(grainCanvas);
            grains.forEach(g => g.rect.setAttribute('display', 'none'));
        } catch (e) { /* the SVG keeps its own grain */ }
    }
    paintGrain();
    // a new size needs the grain painted again at that size; until then the canvas just stretches
    new ResizeObserver(() => { clearTimeout(grainTimer); grainTimer = setTimeout(paintGrain, 200); }).observe(el);
    const NS = 'http://www.w3.org/2000/svg';
    const add = (parent, html, before = null, attrs = {}) => {
        const g = document.createElementNS(NS, 'g');
        Object.entries(attrs).forEach(([k, v]) => g.setAttribute(k, v));
        g.innerHTML = html;
        return parent.insertBefore(g, before);
    };
    const drop = (list, idx) => idx.forEach(i => list[i].remove());

    const port = city.children[1], town = city.children[2];
    const portB = [...port.children], townB = [...town.children];
    const ground = fore.children[0].children[1], portBush = [...ground.children], townBush = [...fore.children[1].children];
    const hill = fore.children[2].children[0];
    drop(portB, [0, 1, 2, 7, 8, 9, 15, 16]);
    const SHIFT = [-532, 70];
    portB[3].setAttribute('transform', `translate(${SHIFT})`);    // the braced glass tower moves left, beside the navy one and a little shorter     // the pyramid, the glass tower and the blocks where the harbour goes
    drop(townB, [0, 5, 12]);                        // the lettered water tower, the pyramid-capped tower, the spire
    drop(townBush, [24]);                           // the domed hall
    drop(portBush, [1, 2, 3, 4, 6, 7, 9, 11, 12, 13, 14, 15, 18, 19, 22, 23]);     // open the view to the water and the yard
    const lights = [];      // window glow, shown at night
    // the visible face of each remaining building (its clip outline; the paint inside overshoots)
    const keep = [...port.children, ...town.children].flatMap(b => {
        const faces = [...b.querySelectorAll('clipPath path')];
        return (faces.length ? faces : [b]).map(n => { const r = n.getBBox(); if (b === portB[3]) { r.x += SHIFT[0]; r.y += SHIFT[1]; } return r; });
    });

    // ---- the port (upper island), drawn in its own units, ground line at y = 0 --
    const K = 1.5, GY = 666;
    let yard = '';
    [3, 2].forEach((n, s) => { for (let k = 0; k < n; k++) yard += crate(54 + s * 27.5, -12.8 * (k + 1), [7, 4, 2, 6, 7][s * 3 + k]); });
    function crane(x, reach, col, c) {
        const top = -112;
        lights.push(`<rect x="${332 + (x + 14) * K}" y="${GY + (top - 12) * K}" width="9" height="7.5"/>`);
        return `<g stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M${x} 0L${x + 8} ${top}M${x + 42} 0L${x + 34} ${top}M${x + 4} -56H${x + 38}M${x - 22} ${top}H${x + reach}"/>` +
            `<path d="M${x + 21} ${top - 30}L${x - 22} ${top}M${x + 21} ${top - 30}L${x + reach} ${top}M${x + 21} ${top - 30}V${top}M${x + 5} -54L${x + 39} -22M${x + 37} -54L${x + 3} -22" stroke-width="2"/></g>` +
            rect(x + 11, top - 16, 20, 13, C.cream) + rect(x + 14, top - 12, 6, 5, C.navy);
    }
    // the working parts: trolley, cable, spreader and load. They sit behind the stack, so a load
    // lowered at the right disappears behind it; at the left it comes up from behind the ground.
    // The timing is the trolley/hoist/cable/load keyframes in scene.css.
    const rig = (x, top = -112) => `<g class="trolley">${rect(x - 16, top + 2, 12, 5, C.navy)}` + line(`M${x - 10} ${top + 7}V${top + 28}`, C.navy, 1.2, ' class="cable"') +
        `<g class="hoist">${rect(x - 18, top + 25.4, 16, 2.6, C.navy)}<g class="load">${crate(x - 23, top + 28, 6)}</g></g></g>`;
    const quay = add(port, rig(10) + yard + crane(10, 100, C.red, 0), null, { transform: `translate(332 ${GY}) scale(${K})` });

    // each trip brings a container of the next colour
    let trip = 0;
    quay.querySelector('.load').addEventListener('animationiteration', e => {
        const i = [2, 4, 7, 6][trip++ % 4], box = e.currentTarget.firstChild;
        box.dataset.i = i;
        box.setAttribute('fill', PAL[i]);
    });

    // the bay: water laid in with a loaded brush, a container ship at the berth
    const sea = (top, bottom) => {
        const pts = [[578, top], [700, top - 1], [940, top]];
        for (let x = 940; x >= 574; x -= 40) pts.push([x, bottom + R(-4, 4)]);
        let strokes = '';
        for (let i = 0; i < 9; i++) strokes += dab(R(590, 800), R(top + 4, bottom - 6), R(30, 80), 0, 2.4);
        return path(smooth(pts), C.sea) + path(strokes, '#1c5f9c', ' opacity=".5"');
    };
    const ripple = (y0, y1) => `<path class="ripple" d="M${f(R(596, 800))} ${f(R(y0, y1))}h${f(R(12, 28))}" stroke="#d8ecfa" stroke-width="2.2" stroke-linecap="round" style="animation-delay:-${f(R(0, 4))}s"/>`;
    let deck = '';
    [[2, 4], [7, 2], [4, 6], [7]].forEach((col, c) => col.forEach((i, r) => { deck += crate(44 + c * 27, -13 - r * 12.6, i); }));
    const ship = `<g class="react" data-act="ship"><g class="bob" style="transform-origin:690px 666px"><g transform="translate(560 644) scale(${K})">` +
        `<g class="steam" fill="${C.shade}"><circle cx="19" cy="-64" r="6"/><circle cx="27" cy="-72" r="8"/><circle cx="39" cy="-78" r="6"/></g>` + deck +
        rect(6, -32, 30, 32, C.cream) + rect(3, -41, 36, 9, C.cream) + line('M7 -36.5h28', C.navy, 3.4) + line('M10 -24h22M10 -14h22', C.navy, 3, ' stroke-dasharray="4 5"') +
        rect(13, -56, 11, 15, C.red) + rect(13, -56, 11, 4.5, C.navy) + line('M31 -41v-17M27 -54h8', C.navy, 1.6) + line('M163 -5v-15', C.navy, 1.6) + path('M163 -20l-10 3.5l10 3.5z', C.yellow) +
        path('M0 0H152L176 -7L164 20H8Q0 20 0 12Z', C.navy) + path('M0 13H167.1L164 20H8Q0 20 0 13Z', C.red) + line('M4 4H158', '#fff', 1.2, ' opacity=".4"') + '</g></g></g>';
    let back = '', front = '';
    for (let i = 0; i < 5; i++) back += ripple(638, 648);
    for (let i = 0; i < 9; i++) front += ripple(675, 686);
    // the water lies on the island itself, behind the shore bushes and inside the island's outline
    add(ground, sea(632, 700) + back + ship + sea(669, 712) + front, ground.children[1]);

    // ---- inland (lower town): silos, a water tower, the works ----------------
    const base = townB[13];     // the long white buildings stay in front
    let silos = '';
    [[158, 128], [182, 152], [206, 112]].forEach(([x, h], i) => {
        const y = 1052 - h;
        let hoops = '';
        for (let yy = y + 18; yy < 1040; yy += 22) hoops += `M${x} ${yy}h24`;
        silos += rect(x, y, 24, h, i % 2 ? C.shade : C.cream) + rect(x + 17, y, 7, h, 'rgba(0,0,0,.07)') + line(hoops, '#d7c8a6', 1.6) +
            path(`M${x - 1.5} ${y}q13.5 -17 27 0z`, C.orange) + fleck(14, x + 2, y + 4, x + 20, 1040);
    });
    add(town, silos, base);
    lights.push('<circle class="tw" cx="636" cy="884" r="3.4" fill="#e3292e"/>');
    add(town, line('M612 1078L624 962M660 1078L648 962M636 1078V962M616 1040H656M620 1000H652', C.cream, 3.4, ' stroke-linecap="round"') +
        `<ellipse cx="636" cy="936" rx="37" ry="29" fill="${C.yellow}"/>` + line('M600 933q36 11 72 0', C.cream, 7) + fleck(22, 606, 916, 664, 956) +
        rect(629, 899, 14, 9, C.yellow) + line('M636 899v-12', C.navy, 2.2), base);
    let works = '';
    [[708, 772, 26], [750, 838, 22]].forEach(([x, top, w], c) => {
        for (let i = 0; i < 3; i++) works += dot(x + w / 2, top - 8, 10, C.shade, ` class="smoke" style="animation-delay:-${i * 2 + c}s"`);
        works += dot(x + w / 2, top - 10, 13, C.shade, ' class="steam"') +
            path(`M${x} 1082L${x + 4} ${top}h${w - 8}L${x + w} 1082Z`, C.red) + rect(x + 3.6, top + 14, w - 7.2, 9, C.cream) + rect(x + 3.2, top + 34, w - 6.4, 9, C.cream) +
            rect(x + 2.4, top - 4, w - 4.8, 7, C.navy) + fleck(40, x + 5, top + 10, x + w - 6, 1070);
    });
    add(town, works, base, { 'data-act': 'works' });
    // ---- the freight line, over the hill and away behind the wheat ------------
    const track = 'M-90 1214C-20 1200 90 1186 185 1171S300 1157 340 1157S480 1176 550 1196S640 1228 680 1246';
    const T = 1.3, run = begin => `<animateMotion dur="44s" repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.62;1" path="${track}" begin="${f(begin)}s"/>`;
    let train = `<g>${run(-14)}<g transform="scale(${T}) translate(23 0)">` +
        `<g class="steam" fill="${C.shade}"><circle cx="-14" cy="-36" r="5"/><circle cx="-22" cy="-43" r="7"/><circle cx="-33" cy="-47" r="5"/></g>` +
        path('M-46 -9V-31h17v6h19q9 0 10 9v7z', C.orange) + rect(-46, -14, 46, 5, C.navy) + rect(-43, -28, 11, 8, C.lblue) + rect(-18, -29, 5, 4, C.navy) +
        dot(-2.5, -19, 1.8, '#fff7c9') + dot(-8, -3.4, 3.4, C.navy) + dot(-20, -3.4, 3.4, C.navy) + dot(-38, -3.4, 3.4, C.navy) + '</g></g>';
    for (let k = 0; k < 6; k++) {
        train += `<g>${run(-14 + 2.05 + k * 1.52)}<g transform="scale(${T}) translate(-14 0)">` + rect(0, -8.4, 28, 2.8, C.navy) + dot(5, -3, 3, C.navy) + dot(23, -3, 3, C.navy) + line('M28 -7h3', C.navy, 1.6) +
            (k === 2 ? path(smooth([[0, -14], [3, -20], [14, -21], [25, -20], [28, -14], [25, -8.5], [14, -8], [3, -8.5]]), C.cream) + rect(11, -20, 6, 11.6, C.red) + rect(11, -22.5, 6, 3, C.navy)
                : crate(1, -20.8, [2, 7, 0, 4, 6, 2][k], 26, 12.4)) + '</g></g>';
    }
    add(hill, line(track, '#d9c9a0', 9) + line(track, C.brown, 5, ' stroke-dasharray="3 7"') + line(track, C.navy, 1.6, ' transform="translate(0 -2.4)"'));
    add(hill, train, null, { 'data-act': 'train' });

    // ---- a pinwheel in the wheat, turning in the breeze; its eight vanes are the container colours
    const px = 216, py = 1250, pr = 44;
    let vanes = '';
    for (let i = 0; i < 8; i++) {
        const L = pr * R(0.95, 1.04), wl = R(0.44, 0.52), wr = R(0.44, 0.52);
        vanes += `<g transform="rotate(${f(i * 45 + R(-3, 3))} ${px} ${py})">` +
            path(`M${px} ${py - 4}C${f(px - pr * wl)} ${f(py - L * 0.4)} ${f(px - pr * 0.34)} ${f(py - L * 0.92)} ${px} ${f(py - L)}C${f(px + pr * 0.34)} ${f(py - L * 0.92)} ${f(px + pr * wr)} ${f(py - L * 0.4)} ${px} ${py - 4}Z`, PAL[i]) +
            path(`M${px} ${py - 4}C${f(px + pr * 0.2)} ${f(py - L * 0.4)} ${f(px + pr * 0.16)} ${f(py - L * 0.9)} ${px} ${f(py - L)}C${f(px + pr * 0.34)} ${f(py - L * 0.92)} ${f(px + pr * wr)} ${f(py - L * 0.4)} ${px} ${py - 4}Z`, 'rgba(0,0,0,.13)') + '</g>';
    }
    add(fore.children[2], line(`M${px} ${py}Q${px - 12} ${py + 120} ${px - 38} 1500`, C.cream, 3.6, ' stroke-linecap="round"') +
        `<g class="react" data-act="pinwheel" style="transform-origin:${px}px ${py}px"><g class="spin" style="transform-origin:${px}px ${py}px">${vanes}${fleck(26, px - 26, py - 26, px + 26, py + 26)}</g>` +
        dot(px, py, 6.5, C.cream) + dot(px, py, 2.6, C.orange) + '</g>', fore.children[2].querySelector(':scope > .home-painting-leaf'), { class: 'home-painting-sway home-painting-leaf' });

    // ---- air freight, in front of the clouds ----------------------------------
    const plane = add(root, '<g transform="scale(1.45)"><g class="react" data-act="plane" style="transform-box:fill-box;transform-origin:center">' +
        path('M-33 -0.2V3L-108 1.4Z', '#fff', ' opacity=".7"') +                                                       // contrail
        path('M-30 0.6l-8 -3.6h6.5l8.5 3.6z', C.red) + path('M-29.5 -3.5L-37 -17.5h7.5L-17 -6z', C.red) +                // tailplane and fin
        path('M-30 -1C-30 -5 -24 -6 -18 -6H14C24 -6 31 -2.2 32 1C30 4 22 5.5 14 5.5H-20C-27 5.5 -30 3 -30 -1Z', C.cream) +
        path('M-29.2 2.2H31C28.4 4.4 22 5.5 14 5.5H-20C-25 5.5 -28.2 4.3 -29.2 2.2Z', C.navy) +                          // belly
        path('M21.5 -3.6q5.4 0.6 7.6 3.2h-7.6z', C.navy) +                                                              // cockpit
        line('M-13 -1.4H16', C.navy, 2.2, ' stroke-dasharray="2.2 3.4"') +                                              // cabin windows
        '<rect x="-4" y="5" width="12" height="4.6" rx="2.3" fill="' + C.navy + '"/>' +                                 // engine
        path('M5 0.8L-11 15.5h7.5L14 0.8Z', C.red) + '</g></g>', city, { class: 'plane' });

    // ---- night: the sun (tap it), stars, lit windows, and the plan drawn between the nodes
    const sx = 270, sy = 148;
    let rays = '', stars = '';
    // long and short rays by turns
    for (let i = 0; i < 12; i++) rays += `<path d="M0 -46v-${f(R(10, 16) * (i % 2 ? 0.55 : 1.1))}" transform="rotate(${i * 30})"/>`;
    // stars keep to open sky: clear of the clouds, the buildings, the port and the sun
    const puffs = [...clouds.querySelectorAll('clipPath path')], pt = root.createSVGPoint();
    const taken = [[320, 470, 830, 720], [sx - 75, sy - 75, sx + 75, sy + 75], [590, 760, 790, 1100], [140, 890, 240, 1100],
        ...keep.map(b => [b.x - 10, b.y - 10, b.x + b.width + 10, b.y + b.height + 10])];
    for (let i = 0; i < 420; i++) {
        pt.x = R(0, 816); pt.y = rnd() < 0.75 ? R(60, 600) : R(735, 900);
        if (taken.some(b => pt.x > b[0] && pt.x < b[2] && pt.y > b[1] && pt.y < b[3]) || puffs.some(p => p.isPointInFill(pt))) continue;
        stars += `<circle class="tw" cx="${f(pt.x)}" cy="${f(pt.y)}" r="${f(R(1, 2.2))}" style="animation-delay:-${f(R(0, 5))}s"/>`;
    }
    keep.forEach(b => {
        const floor = Math.min(b.y + b.height - 46, b.y < 760 ? 640 : 1004);
        for (let y = b.y + 12; y < floor; y += 13) for (let x = b.x + 8; x < b.x + b.width - 9; x += 10.5)
            if (rnd() < 0.2) lights.push(`<rect x="${f(x)}" y="${f(y)}" width="4.6" height="5.6" rx="0.8"/>`);
    });
    const nodes = [[455, 640], [700, 628], [123, 500], [194, 960], [636, 930], [741, 900], [250, 1160]];
    const routes = 'M700 628Q580 560 455 640C440 800 194 820 194 960C200 1060 230 1110 250 1160M455 640C470 800 600 820 636 930Q700 890 741 900M455 640C400 560 240 470 123 500';
    add(root, '<rect class="veil" x="-100" y="-100" width="1016" height="1700" fill="#151b4d" style="mix-blend-mode:multiply"/>', texture, { 'pointer-events': 'none' });
    add(root, stars, texture, { class: 'stars home-painting-clouds', fill: '#fff', 'pointer-events': 'none' });
    // The sun and the moon share one centre and one radius, so one turns into the other in place.
    // Both are painted the way the rest of the picture is: flat gouache shapes, a lighter layer
    // laid over a darker one, a few confident brush strokes and the same flecks of paint.
    const strokes = (ds, colour, sw, o) => `<g fill="none" stroke="${colour}" stroke-width="${sw}" stroke-linecap="round" opacity="${o}">${ds.map(d => `<path d="${d}"/>`).join('')}</g>`;
    const blob = (pts, fill) => path(smooth(pts), fill);
    const crater = ([x, y, r]) => dot(x, y, r, '#cfc7b4') + dot(x - r * 0.18, y - r * 0.18, r * 0.62, '#e4ddcb');
    const sunFace =
        '<circle r="54" fill="url(#sun-glow)"/><circle r="36" fill="#f0a322"/><g clip-path="url(#orb)">' +
        blob([[-36, -36], [22, -38], [33, -12], [27, 14], [8, 29], [-16, 32], [-38, 20]], '#f6b62a') +        // lit from the upper left
        blob([[-34, -34], [8, -34], [19, -15], [13, 5], [-4, 15], [-22, 14], [-36, 2]], '#fbc944') +
        blob([[-26, -27], [-6, -28], [3, -17], [-2, -5], [-15, -1], [-27, -8]], '#fedc72') +
        strokes(['M12 30C22 25 30 16 33 5', 'M-2 34C8 34 16 31 22 26', 'M26 -4C28 -12 27 -19 23 -26'], '#e28d17', 2.2, 0.75) +       // warm strokes round the shaded limb
        strokes(['M-29 -13C-27 -21 -21 -28 -13 -31', 'M-20 -10C-18 -16 -14 -20 -9 -22'], '#fff3bf', 1.8, 0.85) +
        fleck(34, -30, -30, 28, 28) + '</g>';
    const moonFace =
        '<circle r="56" fill="url(#moon-glow)"/><circle r="36" fill="#d9d2bf"/><g clip-path="url(#orb)">' +
        blob([[-36, -36], [24, -38], [34, -10], [28, 16], [8, 30], [-18, 33], [-38, 18]], '#ece6d5') +
        blob([[-34, -34], [6, -34], [17, -16], [11, 3], [-6, 13], [-24, 12], [-36, 0]], '#f7f2e4') +
        // the seas, as three flat patches
        blob([[-20, -22], [-8, -25], [0, -17], [-3, -8], [-13, -5], [-22, -11]], '#d3ccba') +
        blob([[2, -6], [13, -9], [21, -1], [17, 9], [6, 10], [0, 3]], '#d0c9b6') +
        blob([[-21, 5], [-11, 2], [-5, 10], [-10, 19], [-20, 18], [-25, 11]], '#d6cfbd') +
        [[13, -22, 3.2], [-27, -2, 2.4], [5, 21, 3.6], [22, 14, 2.2], [-6, -1, 1.8], [-14, 27, 2], [25, -9, 1.6]].map(crater).join('') +
        strokes(['M14 30C23 25 30 17 33 6'], '#bdb5a2', 2, 0.7) + fleck(30, -30, -30, 28, 28) + '</g>';
    const sun = add(root,
        '<defs><clipPath id="orb"><circle r="36"/></clipPath>' +
        '<radialGradient id="sun-glow"><stop offset=".62" stop-color="#ffd75e" stop-opacity=".42"/><stop offset="1" stop-color="#ffd75e" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="moon-glow"><stop offset=".6" stop-color="#e6ecff" stop-opacity=".2"/><stop offset="1" stop-color="#e6ecff" stop-opacity="0"/></radialGradient></defs>' +
        `<g class="rayset"><g class="rays" stroke="${C.yellow}" stroke-width="5.5" stroke-linecap="round">${rays}</g></g>` +
        `<g class="sunface">${sunFace}</g><g class="moonface">${moonFace}</g>`,
        texture, { class: 'sun react', 'data-act': 'sun', style: `translate:${sx}px ${sy}px;transform-box:view-box;transform-origin:0 0` });      // translate, not transform: the click pulse animates transform
    // A short or narrow panel crops the painting. Keep the sun inside what is showing, since it
    // is the night switch, and move the plane's path down with it so it still passes underneath.
    const settle = () => {
        const b = el.getBoundingClientRect();
        if (!b.width) return;
        const k = Math.max(b.width / 816, b.height / 1488), top = (1488 - b.height / k) / 2, left = (816 - b.width / k) / 2;
        const x = Math.max(sx, left + 74), y = Math.max(sy, top + 74);
        sun.style.translate = `${f(x)}px ${f(y)}px`;
        plane.style.translate = `0px ${f(y - sy)}px`;
    };
    settle();
    addEventListener('resize', settle);
    add(root, lights.join('') + `<path class="route" d="${routes}" stroke="#ffe7a6" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 10" fill="none"/>` +
        nodes.map(([x, y]) => dot(x, y, 4.6, '#ffe7a6')).join(''), texture, { class: 'lights', fill: '#ffd97a', 'pointer-events': 'none', 'data-depth': 5 });

    // the flowers answer a click; the far and near layers drift a little with the pointer
    fore.querySelectorAll('.home-painting-flower').forEach(n => { n.dataset.act = 'flower'; });
    [[city, 5], [fore, 10]].forEach(([n, depth]) => { n.setAttribute('overflow', 'visible'); n.dataset.depth = depth; });
    // the train is SMIL, which the reduced-motion stylesheet cannot reach
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.pauseAnimations();
    document.dispatchEvent(new Event('scene:ready'));
})();
