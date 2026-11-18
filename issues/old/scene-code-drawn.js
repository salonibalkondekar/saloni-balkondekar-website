// Live painting, drawn in code: one supply chain, read from the top down. A port
// city floats above; inland, a factory, silos and a distribution centre sit on
// the freight line; below them are the fields the goods come from, and a
// rainbow flower in the foreground. Tap the sun for night.
(function () {
    const el = document.getElementById('scene');
    if (!el) return;

    let seed = 23;
    const rnd = () => {
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const R = (a, b) => a + rnd() * (b - a);
    const pick = a => a[Math.floor(rnd() * a.length)];
    const f = n => (Math.round(n * 10) / 10);
    const C = {
        cloud: '#f7f1e2', navy: '#22305c', slate: '#3b4b85', red: '#d6452f', pink: '#eea3b7', yellow: '#edb73e',
        orange: '#e78a38', g1: '#1f5a3a', g2: '#3a8045', g3: '#6ba74c', g4: '#a9c75b', teal: '#3b9a93', white: '#fbf6ea',
        tan: '#e5d5b0', sand: '#cdbd98', blue: '#3f79bd', lblue: '#a9d3ea', brown: '#8b5a34'
    };
    // the flower's eight petals; containers are painted from the same tubes
    const PAL = ['#7b62b5', '#d2608f', C.red, C.orange, C.yellow, C.g3, C.teal, C.blue];
    el.dataset.pal = PAL.join(' ');
    const pal = () => Math.floor(rnd() * 8);

    const o = [];
    const lights = { port: [], town: [] };
    const occ = [];     // boxes the stars must stay out of
    let band = 'port';
    const layer = depth => o.push(`<g class="layer" data-depth="${depth}">`);
    const end = () => o.push('</g>');
    const P = (x, y) => f(x) + ' ' + f(y);
    const path = (d, fill, extra = '') => `<path d="${d}"${fill ? ` fill="${fill}"` : ''}${extra}/>`;
    const line = (d, stroke, sw, extra = '') => `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="none"${extra}/>`;
    const dot = (x, y, r, fill, extra = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${extra}/>`;
    const lit = s => lights[band].push(s);
    const sway = (x, y, body, amp = 3) =>
        `<g class="sway" style="transform-origin:${f(x)}px ${f(y)}px;--amp:${f(amp)}deg;--d:${f(R(3, 6))}s;--o:-${f(R(0, 6))}s">${body}</g>`;

    // ---- the hand: nothing is ruled or compass-drawn -----------------------
    // a smooth closed curve through loose points
    function smooth(pts) {
        const n = pts.length, mid = i => P((pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2);
        return 'M' + mid(n - 1) + pts.map((p, i) => 'Q' + P(p[0], p[1]) + ' ' + mid(i)).join('') + 'Z';
    }
    // a polygon cut with scissors: corners nudged, edges bowed by a hair
    function cut(pts, j = 0.7) {
        const q = pts.map(([x, y]) => [x + R(-j, j), y + R(-j, j)]);
        return 'M' + P(q[0][0], q[0][1]) + q.map((a, i) => {
            const b = q[(i + 1) % q.length];
            return 'Q' + P((a[0] + b[0]) / 2 + R(-j, j), (a[1] + b[1]) / 2 + R(-j, j)) + ' ' + P(b[0], b[1]);
        }).join('') + 'Z';
    }
    const rect = (x, y, w, h, fill, extra = '') => path(cut([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Math.min(0.7, Math.min(w, h) * 0.07)), fill, extra);
    // a lumpy ring of points
    const ring = (cx, cy, rx, ry, n, wob) => Array.from({ length: n }, (_, i) => {
        const a = (i + R(-0.25, 0.25)) / n * 2 * Math.PI, k = 1 + R(-wob, wob);
        return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    });
    // one tapered brush stroke
    function dab(x, y, L, ang, w) {
        const c = Math.cos(ang), s = Math.sin(ang), mx = x + c * L / 2, my = y + s * L / 2;
        return `M${P(x, y)}Q${P(mx - s * w, my + c * w)} ${P(x + c * L, y + s * L)}Q${P(mx + s * w * 0.3, my - c * w * 0.3)} ${P(x, y)}Z`;
    }
    const dabs = (n, x0, y0, x1, y1, l0, l1, ang, w) => Array.from({ length: n }, () => dab(R(x0, x1), R(y0, y1), R(l0, l1), ang + R(-0.06, 0.06), R(w * 0.5, w))).join('');
    // flecks of paint, light and dark, for tooth inside flat areas
    function fleck(n, x0, y0, x1, y1) {
        let a = '', b = '';
        for (let i = 0; i < n; i++) {
            const r = R(0.35, 0.9), s = `M${P(R(x0, x1), R(y0, y1))}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
            if (i % 3) a += s; else b += s;
        }
        return path(a, '#fff', ' opacity=".4" pointer-events="none"') + path(b, '#2a1c10', ' opacity=".14" pointer-events="none"');
    }
    const wall = (x, y, w, h, fill) => rect(x, y, w, h, fill) + fleck(Math.round(w * h / 90), x + 2, y + 2, x + w - 3, y + h - 2);

    // a cumulus: lumps of varied height on top, a ragged underside, a broken white rim
    function cumulus(x, y, w, h, lo = 0.3, even = 0.7) {
        const n = Math.max(3, Math.round(w / 36)), lumps = [], top = [], bot = [], ph = R(0, 6);
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n, H = h * (lo + (1 - lo) * Math.sin(Math.PI * t) ** 0.7) * R(even, 1.05);
            const r = Math.max(w / n * 0.56, Math.min(H * 0.5, w / n * R(0.7, 1.05))), cx = x + w * t + R(-6, 6);
            lumps.push([cx, y - H + r, r]);
            if (t > 0.2 && t < 0.8 && rnd() < 0.5) lumps.push([cx + R(-12, 12), y - H + r * R(0.1, 0.5), r * R(0.55, 0.8)]);   // a tower on top
        }
        for (let px = x; px <= x + w; px += 4) {
            let ty = y - 4;
            lumps.forEach(([cx, cy, r]) => { if (Math.abs(px - cx) < r) ty = Math.min(ty, cy - Math.sqrt(r * r - (px - cx) ** 2)); });
            const edge = Math.min(1, Math.sin(Math.PI * (px - x) / w) * 3);
            top.push([px + R(-0.8, 0.8), ty + R(-0.9, 0.9)]);
            bot.unshift([px + R(-1.5, 1.5), y + edge * (h * 0.07 * Math.sin(px / 19 + ph) + h * 0.05 * Math.sin(px / 7.7 + ph * 2) + R(-2, 2) + h * 0.06)]);
        }
        const rim = 'M' + P(top[0][0], top[0][1]) + top.slice(1, -1).map((p, i) => 'Q' + P(p[0], p[1]) + ' ' + P((p[0] + top[i + 2][0]) / 2, (p[1] + top[i + 2][1]) / 2)).join('');
        return path(smooth(top.concat(bot)), C.cloud) +
            path(dabs(Math.round(w / 45), x + w * 0.15, y - h * 0.34, x + w * 0.7, y - 2, 24, 60, -0.05, 2.6), '#ebe1cc', ' opacity=".8"') +
            line(rim, '#fffefa', 2, ` stroke-linecap="round" stroke-dasharray="${f(R(30, 60))} ${f(R(4, 9))} ${f(R(60, 110))} ${f(R(5, 12))}" transform="translate(-0.8 -1)"`) +
            fleck(Math.round(w * h / 420), x + 12, y - h * 0.55, x + w - 12, y);
    }
    function cloud(x, y, w, h) {
        occ.push([x - 26, y - h - 12, x + w + 26, y + 26]);
        return `<g class="cloud" style="animation-duration:${f(R(24, 46))}s;animation-delay:-${f(R(0, 30))}s"><g class="react" data-act="cloud" style="transform-origin:${f(x + w / 2)}px ${f(y)}px">${cumulus(x, y, w, h)}</g></g>`;
    }

    function windows(x, y, w, h, kind, c) {
        let s = '';
        const n = Math.floor((w - 9) / 7), x0 = x + (w - n * 7) / 2;
        if (kind === 'dots') {
            for (let yy = y + 8; yy < y + h - 4; yy += 8) for (let i = 0; i <= n; i++) {
                s += `<circle cx="${f(x0 + i * 7)}" cy="${f(yy)}" r="1.5"/>`;
                if (rnd() < 0.3) lit(`<circle cx="${f(x0 + i * 7)}" cy="${f(yy)}" r="1.9"/>`);
            }
            return `<g fill="${c}">${s}</g>`;
        }
        if (kind === 'h' || kind === 'grid') for (let yy = y + 8; yy < y + h - 3; yy += 7) {
            s += `M${f(x + 3)} ${f(yy)}H${f(x + w - 3)}`;
            if (rnd() < 0.3) lit(rect(x + 3 + R(0, w - 20), yy - 1.5, 12, 3, ''));
        }
        if (kind === 'v' || kind === 'grid') for (let i = 0; i <= n; i++) s += `M${f(x0 + i * 7)} ${f(y + 5)}V${f(y + h)}`;
        return line(s, c, kind === 'grid' ? 1.2 : 2.2);
    }

    // a bush: a lobed dome with a few confident leaf strokes from the root
    function bush(x, y, w, fill, ink) {
        const h = w * R(0.55, 0.76), n = 6 + Math.floor(w / 11), pts = [];
        for (let i = 0; i <= n; i++) {
            const a = Math.PI * (1 - i / n), k = (i % 2 ? 1.04 : 0.86) * R(0.92, 1.06);
            pts.push([x + Math.cos(a) * w / 2 * k, y - Math.sin(a) * h * k - (i % n ? 0 : 2)]);
        }
        pts.push([x + w * 0.3, y + R(0.5, 3)], [x - w * 0.3, y + R(0.5, 3)]);
        let leaves = '';
        for (let a = R(24, 40); a <= 156; a += R(20, 30)) leaves += dab(x + R(-2, 2), y - 1, h * R(0.5, 0.82), -a * Math.PI / 180, w * 0.055);
        return path(smooth(pts), fill) + path(leaves, ink) + fleck(Math.round(w / 9), x - w * 0.3, y - h * 0.7, x + w * 0.3, y - 3);
    }
    const BUSH = [[C.g2, C.g1], [C.g3, C.g1], [C.pink, '#fff'], [C.red, '#a8301f'], [C.yellow, C.orange], [C.g1, C.g3], [C.g4, C.g2], [C.g2, C.g4]];
    function hedge(x0, x1, y, min = 34, max = 58) {
        for (let x = x0; x < x1; x += R(min * 0.55, min * 0.95)) {
            const [a, b] = pick(BUSH);
            o.push(bush(x, y + R(-4, 5), R(min, max), a, b));
        }
    }

    function tree(x, y, s, fill) {
        let dots = '';
        for (let i = 0; i < 9; i++) dots += `<circle cx="${f(x + R(-15, 15) * s)}" cy="${f(y - 46 * s + R(-14, 14) * s)}" r="${f(R(0.8, 1.4))}"/>`;
        return path(cut([[x - 3 * s, y], [x - 1.6 * s, y - 34 * s], [x + 1.6 * s, y - 34 * s], [x + 3 * s, y]], 0.4), C.brown) + line(`M${f(x)} ${f(y - 22 * s)}l${f(8 * s)} ${f(-9 * s)}M${f(x)} ${f(y - 26 * s)}l${f(-7 * s)} ${f(-7 * s)}`, C.brown, f(1.6 * s), ' stroke-linecap="round"') +
            sway(x, y - 24 * s, path(smooth(ring(x, y - 46 * s, 22 * s, 20 * s, 11, 0.15)), fill) + path(smooth(ring(x + 5 * s, y - 40 * s, 14 * s, 11 * s, 8, 0.2)), 'rgba(0,0,0,.12)') + `<g fill="${C.g4}">${dots}</g>`, 1.5);
    }
    const poplar = (x, y, h, fill) => rect(x - 1.5, y - h * 0.3, 3, h * 0.3, C.brown) + sway(x, y, path(smooth(ring(x, y - h * 0.58, h * 0.15, h * 0.42, 10, 0.1)), fill) + path(dab(x - 2, y - h * 0.2, h * 0.6, -1.5, 2), 'rgba(0,0,0,.14)'), 1.5);
    // a small house tucked among the bushes
    const house = (x, y, w, h, roof = C.red) => rect(x, y - h, w, h, C.white) + path(cut([[x - 3, y - h], [x + w * 0.3, y - h - w * 0.42], [x + w + 3, y - h - w * 0.42 + 2], [x + w + 3, y - h]], 0.5), roof) +
        rect(x + w * 0.16, y - h * 0.62, w * 0.2, h * 0.62, C.navy) + rect(x + w * 0.56, y - h * 0.7, w * 0.24, h * 0.34, C.lblue);

    const crate = (x, y, i, w = 26, h = 12) =>
        `<rect class="crate" data-i="${i}" x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="1.5" fill="${PAL[i]}"/>` +
        `<path d="M${f(x + w / 3)} ${f(y + 2)}v${h - 4}M${f(x + 2 * w / 3)} ${f(y + 2)}v${h - 4}" stroke="rgba(0,0,0,.16)" stroke-width="1" pointer-events="none"/>`;

    function bloom(x, y, r, n, fill, centre, cr = 0.3) {
        let p = '';
        for (let i = 0; i < n; i++) p += `<ellipse cx="${f(x)}" cy="${f(y - r * 0.58)}" rx="${f(r * R(0.26, 0.33))}" ry="${f(r * R(0.44, 0.54))}" transform="rotate(${f(360 / n * i + R(-5, 5))} ${f(x)} ${f(y)})"/>`;
        return `<g class="react" data-act="flower" style="transform-origin:${f(x)}px ${f(y)}px"><g fill="${fill}">${p}</g>${dot(x, y, r * cr, centre)}</g>`;
    }

    // ---- sky -------------------------------------------------------------
    layer(4);
    // long tapered brush strokes, all leaning the same way
    o.push(path(dabs(80, -60, 130, 600, 800, 60, 170, -0.33, 3.6), '#dcecf8', ' opacity=".6"') + path(dabs(50, -60, 130, 600, 800, 50, 140, -0.33, 3), '#6ea6d6', ' opacity=".55"') +
        path(dabs(50, -60, 130, 600, 800, 16, 50, -0.33, 2), '#f1f8fc', ' opacity=".7"'));
    o.push(cloud(338, 352, 330, 150), cloud(-90, 300, 230, 84), cloud(96, 196, 150, 46));
    // air freight
    o.push('<g class="plane"><g class="react" data-act="plane" style="transform-box:fill-box;transform-origin:center">' + line('M-74 4.5h48', '#fff', 2, ' stroke-dasharray="7 6" opacity=".8"') +
        path('M-22 0h36q11 0 15 5q-4 4-15 4h-36q-5-4 0-9z', C.white) + path('M-22 6.5h51q-4 2.5-15 2.5h-36z', C.navy) + path('M2 5l-13 17h8l17-17zM-19 0l-7-11h6l9 11z', C.red) +
        line('M-8 3h20', C.navy, 1.6, ' stroke-dasharray="2 2.5"') + '</g></g>');
    end();

    // ---- the port (upper band) ---------------------------------------------
    const B1 = 455;
    layer(8);
    occ.push([-60, 228, 172, B1 + 90], [150, 300, 420, B1 + 90], [320, 228, 600, B1 + 90]);
    o.push(cumulus(-100, B1 + 64, 430, 84, 0.6, 0.85), cumulus(230, B1 + 70, 460, 88, 0.6, 0.85));     // the cloud it all rests on
    // water laid in with a loaded brush: the lower edge wanders
    const sea = top => {
        const pts = [[300, top], [480, top], [664, top]];
        for (let x = 664; x >= 296; x -= 28) pts.push([x, B1 + 31 + R(-3.5, 3.5)]);
        return path(smooth(pts), C.blue) + path(dabs(18, 306, top + 2, 600, B1 + 27, 20, 60, 0, 1.8), '#2f66a8', ' opacity=".5"');
    };
    // city behind the quay: stepped tower, banded block, control tower
    o.push(wall(16, B1 - 128, 50, 128, C.navy) + rect(22, B1 - 176, 38, 48, C.navy) + rect(29, B1 - 204, 24, 28, C.navy) + line(`M41 ${B1 - 204}v-22`, C.navy, 2.5) +
        windows(16, B1 - 128, 50, 128, 'dots', '#8ea4de') + windows(22, B1 - 176, 38, 48, 'dots', '#8ea4de') + windows(29, B1 - 204, 24, 28, 'dots', '#8ea4de') +
        rect(13, B1 - 131, 56, 4, C.slate) + rect(19, B1 - 179, 44, 4, C.slate) + rect(27, B1 - 207, 28, 4, C.slate));
    o.push(wall(72, B1 - 112, 38, 112, C.g3) + windows(72, B1 - 112, 38, 112, 'h', '#e2f0c9') + rect(78, B1 - 121, 15, 9, C.g2) + rect(97, B1 - 118, 8, 6, C.white));
    o.push(wall(150, B1 - 88, 32, 88, C.pink) + windows(150, B1 - 88, 32, 88, 'dots', '#fff') + rect(148, B1 - 91, 36, 4, '#d98aa1'));
    const cab = `M124.5 ${B1 - 115}h25l3.4 -10h-31.8z`;
    lit(path(cab, ''));
    o.push(path(`M131 ${B1}L133.5 ${B1 - 112}h7L143 ${B1}Z`, C.white) + path(`M124 ${B1 - 112}h26l5 -17h-36z`, C.navy) + path(cab, C.lblue) +
        line(`M131 ${B1 - 115}v-10M137 ${B1 - 115}v-10M143 ${B1 - 115}v-10`, C.navy, 1.2) + rect(117, B1 - 133, 40, 4.5, C.red) + line(`M137 ${B1 - 133}v-15`, C.navy, 1.6) +
        dot(137, B1 - 150, 2.4, C.red, ' class="tw"'));
    // towers across the bay
    o.push(path(cut([[328, B1], [328, B1 - 148], [368, B1 - 166], [368, B1]]), C.g2) + fleck(60, 331, B1 - 140, 365, B1) + windows(328, B1 - 144, 40, 144, 'v', C.g1));
    o.push(path(`M388 ${B1}V${B1 - 188}q1 -28 26 -28.6t26 28.6V${B1}z`, C.lblue) + fleck(70, 391, B1 - 190, 437, B1) + windows(388, B1 - 196, 52, 196, 'h', '#fff') + rect(388, B1 - 188, 9, 188, '#fff', ' opacity=".35"'));
    o.push(wall(448, B1 - 170, 24, 170, C.white) + windows(448, B1 - 170, 24, 170, 'v', C.blue) + rect(452, B1 - 180, 16, 10, C.white) + path(`M452 ${B1 - 180}l8 -22l8 22z`, C.blue));
    o.push(path(`M478 ${B1}V${B1 - 82}a17 17 0 0 1 34 0V${B1}z`, C.pink) + windows(478, B1 - 86, 34, 86, 'dots', '#fff'));
    o.push(wall(516, B1 - 120, 46, 120, C.yellow) + windows(516, B1 - 120, 46, 120, 'dots', C.red) + path(`M513 ${B1 - 120}l26 -19l26 19z`, C.red));
    // lighthouse on the breakwater
    const lh = (t0, t1) => `M${f(575 + 3 * t0)} ${f(B1 - 10 - 52 * t0)}L${f(575 + 3 * t1)} ${f(B1 - 10 - 52 * t1)}H${f(591 - 3 * t1)}L${f(591 - 3 * t0)} ${f(B1 - 10 - 52 * t0)}Z`;
    o.push(path(`M552 ${B1 - 6}q12 -11 26 -7q16 -6 34 5v12h-60z`, '#a08e74') + path(lh(0, 1), C.white) + path(lh(0.2, 0.42) + lh(0.62, 0.84), C.red) +
        line(`M573 ${B1 - 62}h20`, C.navy, 2.2) + rect(578, B1 - 73, 10, 11, '#f7e7ad') + path(`M575 ${B1 - 73}l8 -9l8 9z`, C.red));
    lit(rect(578, B1 - 73, 10, 11, '#fff7c9') + `<path class="beam" d="M583 ${B1 - 68}l-150 -20v40z" fill="#ffefb0" opacity=".3" style="transform-origin:583px ${B1 - 68}px"/>`);
    // transit shed
    o.push(wall(-8, B1 - 32, 112, 32, C.tan) + path(`M-8 ${B1 - 32}q28 -21 56 0q28 -21 56 0z`, C.red) + line(`M20 ${B1 - 42}v9M76 ${B1 - 42}v9`, '#a8301f', 1.5));
    for (let i = 0; i < 3; i++) o.push(rect(3 + i * 34, B1 - 23, 23, 23, C.navy) + line(`M${3 + i * 34} ${B1 - 16}h23M${3 + i * 34} ${B1 - 9}h23`, C.slate, 1.5));
    // quay and container yard
    o.push(rect(-60, B1 - 1, 368, 17, C.sand));
    for (let s = 0; s < 6; s++) for (let k = 0, n = 2 + Math.floor(R(1, 5)); k < n; k++) o.push(crate(112 + s * 27.5, B1 - 12.8 * (k + 1), pal()));
    // ship-to-shore cranes
    function crane(x, reach, col, c) {
        const top = B1 - 112;
        o.push(`<g stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M${x} ${B1}L${x + 8} ${top}M${x + 42} ${B1}L${x + 34} ${top}M${x + 4} ${B1 - 56}H${x + 38}M${x - 22} ${top}H${x + reach}"/>` +
            `<path d="M${x + 21} ${top - 30}L${x - 22} ${top}M${x + 21} ${top - 30}L${x + reach} ${top}M${x + 21} ${top - 30}V${top}M${x + 5} ${B1 - 54}L${x + 39} ${B1 - 22}M${x + 37} ${B1 - 54}L${x + 3} ${B1 - 22}" stroke-width="2"/></g>` +
            rect(x + 11, top - 16, 20, 13, C.white) + rect(x + 14, top - 12, 6, 5, C.navy) +
            `<g class="trolley" style="--run:${reach - 30}px;animation-delay:-${c * 4}s">${rect(x - 16, top + 2, 12, 5, C.navy)}` +
            `<g class="hoist" style="animation-delay:-${c * 2.5}s">${line(`M${x - 10} ${top + 7}V${top + 28}`, C.navy, 1.2)}${crate(x - 23, top + 28, pal())}</g></g>`);
        lit(rect(x + 14, top - 12, 6, 5, ''));
    }
    crane(170, 112, C.yellow, 0);
    crane(256, 138, C.red, 1);
    // the bay, and a container ship at the berth
    o.push(sea(B1 - 15) + rect(300, B1 - 4, 7, 20, '#a89877') + rect(292, B1 - 6, 5, 6, C.navy) + rect(279, B1 - 6, 5, 6, C.navy));
    for (let x = 316; x < 600; x += R(22, 40)) o.push(bush(x, B1 - 13, R(16, 26), pick([C.g2, C.g3, C.g1]), C.g1));
    const ripple = (x0, x1, y0, y1) => `<path class="ripple" d="M${f(R(x0, x1))} ${f(R(y0, y1))}h${f(R(8, 20))}" stroke="#d8ecfa" stroke-width="1.6" stroke-linecap="round" style="animation-delay:-${f(R(0, 4))}s"/>`;
    for (let i = 0; i < 8; i++) o.push(ripple(312, 590, B1 - 9, B1 - 5));
    o.push(`<g class="bob" style="transform-origin:540px ${B1}px;animation-delay:-1.7s">` + path(`M527 ${B1 - 4}h26q-3 7 -13 7t-13 -7z`, C.brown) + line(`M540 ${B1 - 4}v-24`, C.navy, 1.4) +
        path(`M541.5 ${B1 - 27}q11 9 12 20h-12z`, C.white) + path(`M538.5 ${B1 - 23}q-7 8 -8 16h8z`, C.red) + '</g>');
    let deck = '';
    [3, 3, 3, 2].forEach((n, c) => { for (let r = 0; r < n; r++) deck += crate(44 + c * 27, -13 - r * 12.6, pal()); });
    o.push(`<g class="react" data-act="ship"><g class="bob" style="transform-origin:410px ${B1 + 10}px"><g transform="translate(322 ${B1 - 5})">` +
        `<g class="steam" fill="${C.cloud}"><circle cx="19" cy="-64" r="6"/><circle cx="27" cy="-72" r="8"/><circle cx="39" cy="-78" r="6"/></g>` + deck +
        rect(6, -32, 30, 32, C.white) + rect(3, -41, 36, 9, C.white) + line('M7 -36.5h28', C.navy, 3.4) + line('M10 -24h22M10 -14h22', C.navy, 3, ' stroke-dasharray="4 5"') +
        rect(13, -56, 11, 15, C.red) + rect(13, -56, 11, 4.5, C.navy) + line('M31 -41v-17M27 -54h8', C.navy, 1.6) + line('M163 -5v-15', C.navy, 1.6) + path('M163 -20l-10 3.5l10 3.5z', C.yellow) +
        path('M0 0H152L176 -7L164 20H8Q0 20 0 12Z', C.navy) + path('M0 13H167.1L164 20H8Q0 20 0 13Z', C.red) + line('M4 4H158', '#fff', 1.2, ' opacity=".4"') + '</g></g></g>');
    o.push(sea(B1 + 10));
    for (let i = 0; i < 12; i++) o.push(ripple(312, 590, B1 + 15, B1 + 23));
    hedge(-10, 296, B1 + 10, 24, 38);
    hedge(-14, 300, B1 + 19, 18, 28);
    o.push(cumulus(30, B1 + 58, 150, 30), cumulus(396, B1 + 62, 170, 30));
    end();
    layer(6);
    o.push(cloud(20, 606, 250, 76), cloud(396, 582, 230, 64));
    [[318, 566, 1], [338, 556, 0.8], [352, 572, 0.7], [296, 580, 0.6]].forEach(([x, y, k]) => o.push(line(`M${f(x - 7 * k)} ${f(y - 3 * k)}q${f(4 * k)} ${f(-3 * k)} ${f(7 * k)} ${f(3 * k)}q${f(3 * k)} ${f(-6 * k)} ${f(8 * k)} ${f(-4 * k)}`, C.navy, f(1.5 * k), ' stroke-linecap="round" class="bird"')));
    end();

    // ---- inland (lower band): factory, silos, distribution centre, the freight line
    const B2 = 772;
    band = 'town';
    layer(10);
    o.push(cloud(280, 706, 260, 84), path(smooth([[-60, B2 + 4], [-60, B2 - 30], [40, B2 - 58], [120, B2 - 44], [210, B2 - 28], [330, B2 - 40], [440, B2 - 24], [560, B2 - 60], [670, B2 - 66], [670, B2 + 4]]), '#a9d0a4'));
    end();
    layer(12);
    // wind farm on the ridge
    o.push(path(smooth([[430, B2 + 6], [470, B2 - 16], [530, B2 - 38], [590, B2 - 46], [670, B2 - 40], [670, B2 + 6]]), '#84ba8a') + path(dabs(12, 470, B2 - 30, 620, B2 - 6, 20, 50, -0.15, 1.6), '#6fa878', ' opacity=".6"'));
    [[530, 112, 7], [566, 148, 9.5], [600, 100, 6]].forEach(([x, h, dur]) => {
        const y = B2 - h, L = h * 0.36;
        let blades = '';
        for (let a = 0; a < 360; a += 120) blades += `<path d="M${x} ${y}q5.5 ${f(-L * 0.3)} 1 ${f(-L)}q-4.5 ${f(L * 0.5)} -1 ${f(L)}z" transform="rotate(${a} ${x} ${y})"/>`;
        o.push(path(`M${x - 2.8} ${B2 - 18}L${x - 1.3} ${y}h2.6L${x + 2.8} ${B2 - 18}Z`, C.white) +
            `<g class="react" data-act="turbine" style="transform-origin:${x}px ${y}px">${dot(x, y, L, 'transparent')}<g class="spin" fill="${C.white}" style="transform-origin:${x}px ${y}px;animation-duration:${dur}s">${blades}</g>${dot(x, y, 3, C.navy)}</g>`);
    });
    // lattice mast
    let lattice = '';
    for (let i = 0; i < 7; i++) lattice += `M${498 - (7 - i)} ${B2 - 36 - i * 16}L${498 + (6 - i)} ${B2 - 52 - i * 16}M${498 + (7 - i)} ${B2 - 36 - i * 16}L${498 - (6 - i)} ${B2 - 52 - i * 16}`;
    o.push(line(`M489 ${B2}L497 ${B2 - 150}M507 ${B2}L499 ${B2 - 150}${lattice}`, C.red, 1.6) + dot(498, B2 - 152, 2.4, C.red, ' class="tw"'));
    // factory: chimneys, saw-tooth roof
    let works = '';
    [[8, 150], [31, 120]].forEach(([x, h], c) => {
        works += path(`M${x} ${B2}L${x + 2.5} ${B2 - h}h9L${x + 14} ${B2}Z`, C.white) + rect(x + 2.3, B2 - h, 9.4, 5, C.red) + rect(x + 2, B2 - h + 10, 10, 4, C.red);
        for (let i = 0; i < 3; i++) works += dot(x + 7, B2 - h - 6, 7, C.cloud, ` class="smoke" style="animation-delay:-${i * 2 + c}s"`);
        works += dot(x + 7, B2 - h - 8, 9, C.cloud, ' class="steam"');
    });
    works += wall(-14, B2 - 50, 130, 50, C.teal);
    for (let i = 0; i < 4; i++) works += path(`M${-14 + i * 32.5} ${B2 - 50}l32.5 -20v20z`, '#2a7a75') + line(`M${17 + i * 32.5} ${B2 - 67}v15`, C.lblue, 3);
    works += rect(-14, B2 - 50, 130, 5, C.white);
    for (let i = 0; i < 4; i++) {
        const a = `M${-6 + i * 22} ${B2 - 20}v-13a6 6 0 0 1 12 0v13z`;
        works += path(a, C.navy);
        if (i % 2) lit(path(a, ''));
    }
    works += rect(86, B2 - 30, 22, 30, C.navy) + line(`M86 ${B2 - 22}h22M86 ${B2 - 14}h22`, C.slate, 1.5);
    o.push(`<g data-act="works">${works}</g>`);
    // conveyor up to the silos
    o.push(line(`M104 ${B2 - 56}L158 ${B2 - 132}`, C.navy, 3.2, ' stroke-linecap="round"') + line(`M131 ${B2 - 94}V${B2}`, C.navy, 1.6));
    [[124, 100], [147, 120], [170, 90]].forEach(([x, h], i) => {
        let hoops = '';
        for (let yy = B2 - h + 14; yy < B2; yy += 17) hoops += `M${x} ${yy}h22`;
        o.push(rect(x, B2 - h, 22, h, i % 2 ? '#efe5cf' : C.white) + rect(x + 16, B2 - h, 6, h, 'rgba(0,0,0,.07)') + line(hoops, '#d7c8a6', 1.4) + path(`M${x - 1} ${B2 - h}q12 -15 24 0z`, C.orange));
    });
    // water tower
    o.push(line(`M213 ${B2}L220 ${B2 - 76}M241 ${B2}L234 ${B2 - 76}M227 ${B2}V${B2 - 76}M216 ${B2 - 28}H238M218 ${B2 - 52}H236`, C.white, 2.4) +
        `<ellipse cx="227" cy="${B2 - 92}" rx="23" ry="18" fill="${C.teal}"/>` + line(`M205 ${B2 - 94}q22 7 44 0`, C.white, 4.5) + rect(223, B2 - 115, 8, 6, C.teal) + line(`M227 ${B2 - 115}v-8`, C.navy, 1.6));
    // distribution centre: glass office, solar roof, a row of dock doors
    o.push(wall(262, B2 - 76, 40, 76, C.blue) + windows(262, B2 - 76, 40, 76, 'grid', C.lblue) + rect(260, B2 - 79, 44, 4.5, C.navy));
    o.push(wall(302, B2 - 52, 174, 52, C.white) + rect(302, B2 - 52, 174, 8, C.yellow) + rect(302, B2 - 44, 174, 2, 'rgba(0,0,0,.1)'));
    for (let i = 0; i < 6; i++) o.push(path(`M${309 + i * 27.5} ${B2 - 52}l6 -10h19l-6 10z`, C.navy) + line(`M${318.5 + i * 27.5} ${B2 - 52}l6 -10`, C.lblue, 1));
    for (let i = 0; i < 5; i++) {
        const x = 311 + i * 28.5;
        o.push(rect(x, B2 - 29, 21, 29, C.navy) + line(`M${x} ${B2 - 22}h21M${x} ${B2 - 15}h21M${x} ${B2 - 8}h21`, C.slate, 1.4) + rect(x - 2, B2 - 33, 25, 3.4, C.red));
        if (i % 2) lit(rect(x, B2 - 29, 21, 29, ''));
    }
    o.push(crate(455, B2 - 10, pal(), 17, 10) + crate(456, B2 - 20.6, pal(), 17, 10));
    // yard, trees and hedges
    o.push(rect(-60, B2 - 1, 720, 40, '#e2d2ab'));
    o.push(poplar(247, B2 + 4, 74, C.g1), poplar(257, B2 + 4, 56, C.g2), tree(116, B2 + 6, 0.9, C.g1), tree(478, B2 + 6, 0.8, C.g2));
    hedge(-20, 250, B2 + 9, 30, 50);
    hedge(488, 640, B2 + 9, 30, 50);
    o.push(house(52, B2 + 14, 30, 19), house(186, B2 + 14, 26, 17, C.navy), house(566, B2 + 14, 28, 18));
    hedge(-20, 250, B2 + 17, 22, 36);
    hedge(486, 640, B2 + 17, 22, 36);
    o.push(bush(270, B2 + 12, 24, C.g2, C.g1), bush(288, B2 + 13, 20, C.pink, '#fff'), bush(462, B2 + 13, 22, C.g3, C.g1));
    // freight line
    o.push(rect(-60, B2 + 30, 720, 9, '#c2b28c') + line(`M-60 ${B2 + 34.5}H660`, C.brown, 4, ' stroke-dasharray="3 7"') + line(`M-60 ${B2 + 31}H660`, C.navy, 1.8));
    let train = `<g class="react" data-act="train" style="transform-box:fill-box;transform-origin:50% 100%">` + path('M-46 -9V-31h17v6h19q9 0 10 9v7z', C.orange) + rect(-46, -14, 46, 5, C.navy) +
        rect(-43, -28, 11, 8, C.lblue) + rect(-18, -29, 5, 4, C.navy) + dot(-2.5, -19, 1.8, '#fff7c9') + dot(-8, -3.4, 3.4, C.navy) + dot(-20, -3.4, 3.4, C.navy) + dot(-38, -3.4, 3.4, C.navy) + '</g>';
    for (let k = 0; k < 7; k++) {
        const x = -78 - 31 * k;
        train += rect(x, -8.4, 28, 2.8, C.navy) + dot(x + 5, -3, 3, C.navy) + dot(x + 23, -3, 3, C.navy) + line(`M${x + 28} -7h3`, C.navy, 1.6) +
            (k === 3 ? path(smooth(ring(x + 14, -14.2, 13.6, 6.2, 10, 0.04)), C.white) + rect(x + 11, -20, 6, 11.6, C.red) + rect(x + 11, -22.5, 6, 3, C.navy)
                : crate(x + 1, -20.8, pal(), 26, 12.4));
    }
    o.push(`<g class="train"><g transform="translate(0 ${B2 + 30})">${train}</g></g>`);
    end();

    // ---- fields: three crops, a farm, the road out ---------------------------
    const F = B2 + 38;
    const b1 = y => 214 - (y - F) * 0.45, b2 = y => 404 + (y - F) * 0.55;
    layer(18);
    o.push(rect(-60, F - 1, 720, 300, C.g3));
    for (let i = 0; i < 10; i++) o.push(line(`M-60 ${F + 12 + i * 11}Q80 ${F + 2 + i * 12} ${f(b1(F + 14 + i * 11))} ${F + 14 + i * 11}`, C.g2, f(2 + i * 0.3), ` opacity=".75" stroke-linecap="round" stroke-dasharray="${f(R(30, 80))} ${f(R(4, 9))} ${f(R(50, 110))} ${f(R(5, 10))}"`));
    let wheat = '', rows = '', hedgerow = '';
    for (let k = 0; k < 22; k++) wheat += `M${b1(F) + 10 + k * 12} ${F}L${b1(F + 150) + 10 + k * 12} ${F + 150}`;
    o.push(path(`M${b1(F)} ${F - 1}H660V${F + 150}H${b1(F + 150)}Z`, '#e3c452') + line(wheat, '#cba63a', 2, ' stroke-linecap="round" stroke-dasharray="26 5 48 7 15 4"') + fleck(120, 180, F + 4, 470, F + 100));
    o.push(path(`M${b2(F)} ${F - 1}H660V${F + 150}H${b2(F + 150)}Z`, C.g4));
    for (let y = F + 9; y < F + 110; y += 10) for (let x = b2(y) + 10 + (y % 20 ? 0 : 5); x < 640; x += 11) rows += `<circle cx="${f(x)}" cy="${y}" r="2.7"/>`;
    for (let y = F + 2; y < F + 120; y += R(7, 10)) hedgerow += `<circle cx="${f(b1(y) + R(-1.5, 1.5))}" cy="${f(y)}" r="${f(R(3.5, 5.5))}"/><circle cx="${f(b2(y) + R(-1.5, 1.5))}" cy="${f(y)}" r="${f(R(3.5, 5.5))}"/>`;
    o.push(`<g fill="${C.g2}">${rows}</g><g fill="${C.g1}">${hedgerow}</g>`);
    [[262, F + 24], [318, F + 50], [356, F + 20]].forEach(([x, y]) => o.push(dot(x, y, 6.5, '#d9b446') + line(`M${x - 3} ${y}a3 3 0 1 1 3 3`, '#b08a2c', 1.3)));
    // farm
    const fy0 = F + 50;
    o.push(tree(566, fy0 + 2, 0.62, C.g1) + rect(538, fy0 - 42, 12, 42, C.white) + path(`M537 ${fy0 - 42}q7 -10 14 0z`, C.navy) + line(`M538 ${fy0 - 28}h12M538 ${fy0 - 14}h12`, '#d7c8a6', 1.3) +
        wall(488, fy0 - 26, 46, 26, C.red) + path(`M484 ${fy0 - 26}L492 ${fy0 - 39}L511 ${fy0 - 48}L530 ${fy0 - 39}L538 ${fy0 - 26}Z`, C.navy) + rect(488, fy0 - 28, 46, 3, C.white) +
        rect(503, fy0 - 18, 16, 18, C.white) + line(`M503 ${fy0 - 18}l16 18M519 ${fy0 - 18}l-16 18`, C.red, 1.4) + rect(507, fy0 - 38, 8, 6, C.white) +
        rect(444, fy0 - 20, 30, 20, C.white) + path(`M440 ${fy0 - 20}l19 -15l19 15z`, C.red) + rect(449, fy0 - 12, 7, 12, C.navy) + rect(461, fy0 - 14, 8, 7, C.lblue) +
        crate(474, fy0 - 9, pal(), 13, 9) + crate(475, fy0 - 18.6, pal(), 13, 9));
    lit(rect(461, fy0 - 14, 8, 7, '') + rect(507, fy0 - 38, 8, 6, ''));
    // road, with a truck taking a container to the port and an auto-rickshaw coming back
    const road = `M-30 ${F + 112}Q170 ${F + 64} 380 ${F + 94}T640 ${F + 66}`;
    o.push(line(road, C.tan, 18) + line(road, '#fff', 1.6, ' stroke-dasharray="9 9"'));
    o.push(`<g><animateMotion dur="26s" repeatCount="indefinite" rotate="auto" path="${road}" begin="-9s"/><g transform="translate(0 -5) scale(1.4)"><g class="react" data-act="truck" style="transform-box:fill-box;transform-origin:50% 100%">` +
        crate(-25, -18, 5, 33, 15.5) + path('M10 -2.5v-11q0 -3 3 -3h6q3 0 4.5 3l2.5 5v6z', C.red) + path('M15.5 -13.5h4l2.6 5h-6.6z', '#d3e8f6') + rect(-25, -2.5, 51, 2.6, C.navy) + rect(24, -5, 2.4, 2.5, '#fff7c9') +
        dot(-17, 1, 3.5, C.navy) + dot(-7, 1, 3.5, C.navy) + dot(17, 1, 3.5, C.navy) + dot(-17, 1, 1.2, C.tan) + dot(-7, 1, 1.2, C.tan) + dot(17, 1, 1.2, C.tan) + '</g></g></g>');
    o.push(`<g><animateMotion dur="33s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="${road}" begin="-3s"/><g transform="translate(0 1) scale(-1.8 1.8)"><g class="react" data-act="rickshaw" style="transform-box:fill-box;transform-origin:50% 100%">` +
        path('M-12 -4v-9q0 -5 6 -5h9q7 0 9 9v5z', C.yellow) + path('M-12 -4h24v4h-24z', C.navy) + path('M-3 -15h6q4 0 5 6h-11z', '#d3e8f6') + rect(-10, -14, 5, 7, C.navy) +
        dot(-7, 1, 3, C.navy) + dot(8, 1, 3, C.navy) + dot(-7, 1, 1, C.tan) + dot(8, 1, 1, C.tan) + '</g></g></g>');
    o.push(path(`M-60 ${F + 144}Q160 ${F + 98} 340 ${F + 120}T660 ${F + 90}V1100H-60Z`, 'url(#meadow)') +
        path(dabs(90, -20, F + 150, 620, 1080, 14, 34, -1.45, 2.2), C.g3, ' opacity=".55"') + path(dabs(60, -20, F + 140, 620, 1080, 12, 28, -1.7, 2), '#efd870', ' opacity=".6"') + fleck(260, 0, F + 140, 600, 1080));
    end();
    // a delivery drone, shuttling between the dock and the farm
    layer(14);
    o.push('<g class="drone"><g transform="scale(1.3)"><g class="react" data-act="drone" style="transform-box:fill-box;transform-origin:center">' + line('M-15 -3.5h30M-15 -3.5v-3M15 -3.5v-3', C.navy, 1.8, ' stroke-linecap="round"') +
        `<ellipse class="rotor" cx="-15" cy="-7" rx="10" ry="1.8" fill="${C.white}"/><ellipse class="rotor" cx="15" cy="-7" rx="10" ry="1.8" fill="${C.white}"/>` +
        rect(-8, -6, 16, 8, C.navy) + dot(4.5, -2, 1.5, C.yellow) + line('M-4.5 2v5M4.5 2v5', C.navy, 1.1) + rect(-7, 7, 14, 10, '#d9a866') + line('M0 7v10', C.red, 2) + '</g></g></g>');
    end();

    // ---- foreground --------------------------------------------------------------
    layer(28);
    const blade = (x, h, lean, w, fill) => path(`M${f(x - w)} 1084Q${f(x + lean * 0.3)} ${f(1084 - h * 0.6)} ${f(x + lean)} ${f(1084 - h)}Q${f(x + lean * 0.5 + w)} ${f(1084 - h * 0.5)} ${f(x + w)} 1084Z`, fill);
    for (let i = 0; i < 120; i++) {
        const x = R(-30, 630);
        o.push(sway(x, 1084, blade(x, R(24, 96), R(-14, 14), R(2.5, 6), pick([C.g2, C.g3, C.g3, C.g4, C.g4, '#c9b83f'])), R(1.5, 4)));
    }
    // jowar stalks
    [[262, 190], [322, 222], [388, 176], [452, 230], [516, 204], [574, 168], [226, 150]].forEach(([x, h]) => {
        const y = 1084, lean = R(-26, 26), tx = x + lean, ty = y - h;
        let grains = '';
        for (let i = 0; i < 12; i++) {
            const t = i / 12, gx = tx - lean * t * 0.22 + (i % 2 ? 6 : -6), gy = ty + 4 + t * 66;
            grains += `<ellipse cx="${f(gx)}" cy="${f(gy)}" rx="5" ry="9" fill="${i % 3 ? C.yellow : C.orange}" transform="rotate(${i % 2 ? 28 : -28} ${f(gx)} ${f(gy)})"/>` + dot(gx, gy, 1.3, C.red);
        }
        o.push(sway(x, y, line(`M${x} ${y}Q${f(x + lean * 0.2)} ${f(y - h * 0.5)} ${f(tx)} ${f(ty)}`, C.g2, 3.5, ' stroke-linecap="round"') +
            line(`M${f(x + lean * 0.1)} ${f(y - h * 0.34)}q${lean > 0 ? -40 : 40} -30 ${lean > 0 ? -52 : 52} 8`, C.g1, 5, ' stroke-linecap="round"') + grains, R(2, 4)));
    });
    // broad dark leaves in front
    [[196, 118, -30], [292, 96, 22], [372, 132, 16], [470, 104, -24], [548, 124, 26], [610, 90, -18]].forEach(([x, h, lean]) =>
        o.push(sway(x, 1084, blade(x, h, lean, 9, C.g1) + line(`M${x} 1084Q${f(x + lean * 0.3)} ${f(1084 - h * 0.55)} ${f(x + lean * 0.9)} ${f(1084 - h * 0.9)}`, C.g2, 1.4), 2)));
    // wild flowers
    [[34, 1002, 40], [246, 1052, 30]].forEach(([x, y, r]) => o.push(sway(x, 1084, bloom(x, y, r, 6, C.red, '#5a1a20', 0.24), 2)));
    [[340, 1040, 20], [498, 1016, 17], [96, 1050, 18], [560, 1060, 15]].forEach(([x, y, r]) => o.push(sway(x, 1084, line(`M${x} ${y}V1084`, C.g1, 2.5) + bloom(x, y, r, 10, '#fff', C.red, 0.32), 3)));
    [[418, 1058, 15], [300, 1000, 13], [540, 982, 12]].forEach(([x, y, r]) => o.push(sway(x, 1084, line(`M${x} ${y}V1084`, C.g1, 2.5) + bloom(x, y, r, 12, C.orange, C.yellow, 0.5), 3)));
    // the rainbow flower
    const fx = 150, fy = 936, fr = 76;
    let petals = '';
    for (let i = 0; i < 8; i++) {
        const L = fr * R(0.94, 1.04), wl = R(0.44, 0.54), wr = R(0.44, 0.54);
        petals += `<g transform="rotate(${f(i * 45 + R(-3, 3))} ${fx} ${fy})">` + path(`M${fx} ${fy - 8}C${f(fx - fr * wl)} ${f(fy - L * 0.4)} ${f(fx - fr * 0.34)} ${f(fy - L * 0.92)} ${fx} ${f(fy - L)}C${f(fx + fr * 0.34)} ${f(fy - L * 0.92)} ${f(fx + fr * wr)} ${f(fy - L * 0.4)} ${fx} ${fy - 8}Z`, PAL[i]) +
            line(`M${fx} ${fy - 16}V${fy - fr * 0.8}`, 'rgba(255,255,255,.4)', 1.4, ' stroke-linecap="round"') + '</g>';
    }
    o.push(sway(fx, 1084,
        line(`M${fx} ${fy}Q${fx + 14} 1010 ${fx - 4} 1084`, C.g1, 5, ' stroke-linecap="round"') + path(`M${fx + 8} 1004q34 -22 52 -2q-26 16 -52 2z`, C.g2) +
        `<g class="hero-flower" data-act="hero" style="transform-origin:${fx}px ${fy}px">${petals}${dot(fx, fy, 16, C.yellow)}${dot(fx, fy, 8, C.orange)}</g>`, 2.2));
    end();

    // ---- night: the sun (tap it), stars, lit windows, and the plan drawn between the nodes
    const sx = 238, sy = 266;     // low enough to survive the panel's top crop
    let rays = '', stars = '';
    for (let i = 0; i < 12; i++) rays += `<path d="M${sx} ${sy - 32}v-${f(R(7, 11))}" transform="rotate(${i * 30} ${sx} ${sy})"/>`;
    occ.push([sx - 50, sy - 50, sx + 50, sy + 50]);
    for (let i = 0; i < 400 && stars.length < 6000; i++) {
        const x = R(0, 600), y = rnd() < 0.7 ? R(150, 440) : R(520, 640);
        if (!occ.some(b => x > b[0] && x < b[2] && y > b[1] && y < b[3])) stars += `<circle class="tw" cx="${f(x)}" cy="${f(y)}" r="${f(R(0.7, 1.6))}" style="animation-delay:-${f(R(0, 5))}s"/>`;
    }
    const nodes = [[300, B1 - 2], [388, B2 - 64], [50, B2 - 72], [511, F + 2]];
    const routes = `M300 ${B1 - 2}C300 ${B1 + 110} 388 ${B2 - 180} 388 ${B2 - 64}M50 ${B2 - 72}C140 ${B2 - 150} 300 ${B2 - 130} 388 ${B2 - 64}C450 ${B2 - 70} 508 ${B2 - 20} 511 ${F + 2}`;
    const sky2 = '<rect class="veil" x="-60" y="-60" width="720" height="1200" fill="#151b4d" style="mix-blend-mode:multiply" pointer-events="none"/>' +
        `<g class="stars" fill="#fff" pointer-events="none">${stars}</g>` +
        `<g class="layer" data-depth="4"><g class="sun react" data-act="sun" style="transform-origin:${sx}px ${sy}px"><g class="rays" stroke="${C.yellow}" stroke-width="4.2" stroke-linecap="round" style="transform-origin:${sx}px ${sy}px">${rays}</g>` +
        `<circle class="disc" cx="${sx}" cy="${sy}" r="24" fill="${C.yellow}"/><circle class="cut" cx="${sx + 11}" cy="${sy - 8}" r="21" fill="#2f426f"/></g></g>` +
        `<g class="layer lights" data-depth="8" fill="#ffe08a" pointer-events="none">${lights.port.join('')}</g><g class="layer lights" data-depth="12" fill="#ffd36b" pointer-events="none">${lights.town.join('')}` +
        `<path class="route" d="${routes}" stroke="#ffe7a6" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1 7" fill="none"/>${nodes.map(([x, y]) => dot(x, y, 3.2, '#ffe7a6')).join('')}</g>`;

    el.innerHTML =
        '<svg viewBox="0 0 600 1080" preserveAspectRatio="xMidYMax slice"><defs>' +
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#82b4e0"/><stop offset="1" stop-color="#b9daf0"/></linearGradient>' +
        '<linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c64a"/><stop offset=".55" stop-color="#b9bf45"/><stop offset="1" stop-color="#7fae3f"/></linearGradient>' +
        '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .16  0 0 0 0 .1  0 0 0 .3 -.09"/></filter></defs>' +
        '<rect x="-60" y="-60" width="720" height="1200" fill="url(#sky)"/>' + o.join('') + fleck(1500, 0, 130, 600, 1080) + sky2 +
        '<rect width="600" height="1080" filter="url(#grain)" pointer-events="none" style="mix-blend-mode:multiply"/></svg>';
    // the road traffic is SMIL, which the reduced-motion stylesheet cannot reach
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) el.firstChild.pauseAnimations();
})();
