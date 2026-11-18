// Sound and small delights. Five short recorded samples (see sounds/CREDITS.md),
// quiet, and only on deliberate presses, never on hover. Nothing is fetched or
// decoded until the first press, and a file that fails to load is simply silent.
(function () {
    const FILES = { click: 'click.wav', pop: 'pop.wav', switch: 'switch.wav', ship: 'ship-horn.m4a', truck: 'truck-horn.m4a' };
    const base = new URL('../sounds/', document.currentScript.src);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = document.getElementById('scene');
    const PAL = scene && scene.dataset.pal ? scene.dataset.pal.split(' ') : ['#7b62b5'];
    let on = localStorage.getItem('sound') !== 'off';
    let ctx, ready;

    // fetch and decode every sample once, on the first press
    function warm() {
        if (ctx || !on) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        ready = {};
        for (const [name, file] of Object.entries(FILES)) {
            ready[name] = fetch(new URL(file, base))
                .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
                .then(data => ctx.decodeAudioData(data))
                .catch(() => null);
        }
    }
    function play(name, { rate = 1, vol = 1, after = 0 } = {}) {
        if (!on) return;
        warm();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const asked = performance.now();
        ready[name].then(buffer => {
            if (!buffer || !on || performance.now() - asked > 500) return;      // too late to feel like a response
            const src = ctx.createBufferSource(), gain = ctx.createGain();
            src.buffer = buffer;
            src.playbackRate.value = rate;
            gain.gain.value = vol;
            src.connect(gain).connect(ctx.destination);
            src.start(ctx.currentTime + after);
        });
    }
    // start loading as the finger goes down, so the sample is ready by the click
    addEventListener('pointerdown', warm, { capture: true, passive: true });

    // petals thrown from a point, in the flower's colours
    function burst(x, y, n = 10) {
        if (still) return;
        const first = Math.floor(Math.random() * 8);
        for (let i = 0; i < n; i++) {
            const bit = document.createElement('div');
            const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
            const reach = 30 + Math.random() * 38;
            const dx = Math.cos(angle) * reach, dy = Math.sin(angle) * reach;
            bit.className = 'petal-bit';
            bit.style.cssText = `left:${x}px;top:${y}px;background:${PAL[(first + i) % PAL.length]}`;
            document.body.appendChild(bit);
            bit.animate([
                { transform: 'translate(0,0) rotate(0deg) scale(0.3)', opacity: 1 },
                { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 180 - 90}deg) scale(1)`, opacity: 1, offset: 0.45 },
                { transform: `translate(${dx * 1.15}px,${dy + 46}px) rotate(${Math.random() * 360 - 180}deg) scale(0.7)`, opacity: 0 }
            ], { duration: 750 + Math.random() * 350, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }).onfinish = () => bit.remove();
        }
    }

    // sound toggle
    const toggle = document.createElement('button');
    toggle.className = 'sound-toggle';
    toggle.setAttribute('aria-label', 'Sound effects');
    toggle.setAttribute('aria-pressed', on);
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>' +
        '<path class="on" d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="off" d="m16 9.5 5 5m0-5-5 5"/></svg>';
    toggle.addEventListener('click', () => {
        on = !on;
        localStorage.setItem('sound', on ? 'on' : 'off');
        toggle.setAttribute('aria-pressed', on);
        play('click');
    });
    document.body.appendChild(toggle);

    document.addEventListener('pointerdown', e => {
        if (e.target.closest && e.target.closest('.button-link, .row')) play('click', { vol: 0.8 });
    });

    // play a one-shot reaction animation on a painted element
    function react(el, name, ms) {
        if (still) return;
        el.classList.remove(name);
        void el.getBoundingClientRect();
        el.classList.add(name);
        clearTimeout(el.timer);
        el.timer = setTimeout(() => el.classList.remove(name), ms);
    }
    // repaint a container; with no index given, take the next colour on the wheel
    function repaint(crate, i = (Number(crate.dataset.i) + 1) % PAL.length) {
        crate.dataset.i = i;
        crate.setAttribute('fill', PAL[i]);
        return i;
    }
    // the one pop, never quite the same twice
    const pop = (rate = 0.92 + Math.random() * 0.3, after = 0) => play('pop', { rate, after });

    const ACTS = {
        sun(el) {
            const night = scene.classList.toggle('night');
            play('switch', { rate: night ? 0.94 : 1.08 });
            react(el, 'pulse', 500);
        },
        ship(el) {
            if (el.classList.contains('sail')) return;      // already under way
            play('ship');
            react(el, 'sail', 11000);
            // out of sight, it swaps its cargo before coming back in
            if (!still) setTimeout(() => el.querySelectorAll('.crate').forEach(c => repaint(c, Math.floor(Math.random() * PAL.length))), 5500);
        },
        truck(el) { play('truck'); react(el, 'hop', 600); },
        // the rest answer with movement only
        rickshaw(el) { react(el, 'hop', 600); },
        train(el) { react(el, 'hop', 600); },
        plane(el) { react(el, 'loop', 1100); },
        turbine(el) { react(el, 'whirl', 2600); },
        drone(el) { react(el, 'wobble', 700); },
        works(el) { react(el, 'huff', 1800); },
        cloud(el) { react(el, 'puff', 700); },
        flower(el, e) { pop(); burst(e.clientX, e.clientY, 8); react(el, 'pulse', 500); },
        hero(el, e) {
            [0.9, 1.12, 1.35].forEach((rate, i) => pop(rate, i * 0.075));
            burst(e.clientX, e.clientY, 14);
            react(el, 'spin-once', 900);
        }
    };

    document.addEventListener('click', e => {
        const t = e.target;
        if (!t.closest) return;
        if (t.closest('.button-link')) return burst(e.clientX, e.clientY, 8);
        // containers riding on the ship or the truck belong to the vehicle
        const el = t.closest('[data-act]');
        if (el) return ACTS[el.dataset.act](el, e);
        if (t.classList.contains('crate')) pop(0.85 + repaint(t) * 0.06);
    });

    if (scene && !still) {
        // plants rustle when the pointer brushes them
        scene.addEventListener('pointerover', e => {
            const plant = e.target.closest('.sway');
            if (plant && !plant.classList.contains('rustle')) react(plant, 'rustle', 700);
        });
        // parallax: nearer layers move further with the pointer
        const layers = [...scene.querySelectorAll('[data-depth]')];
        let tx = 0, ty = 0, cx = 0, cy = 0;
        addEventListener('pointermove', e => {
            const box = scene.getBoundingClientRect();
            tx = Math.max(-1, Math.min(1, (e.clientX - box.left - box.width / 2) / innerWidth * 1.6));
            ty = Math.max(-1, Math.min(1, (e.clientY - box.top - box.height / 2) / innerHeight * 1.6));
        });
        (function frame() {
            cx += (tx - cx) * 0.06;
            cy += (ty - cy) * 0.06;
            layers.forEach(l => { l.style.transform = `translate(${(-cx * l.dataset.depth * 0.55).toFixed(2)}px,${(-cy * l.dataset.depth * 0.2).toFixed(2)}px)`; });
            requestAnimationFrame(frame);
        })();
    }
})();
