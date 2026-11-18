import { launch } from './cdp.mjs';
const url = process.argv[2] || 'http://localhost:5175/play.html', W = +(process.argv[3] || 600), H = +(process.argv[4] || 1080);
const c = await launch({ w: W, h: H, port: 9336 });
await c.goto(url, 1500);
const res = [];
const ok = (name, pass, note = '') => { res.push([name, pass]); console.log((pass ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); };
// centre of the first element matching sel that is on screen and actually on top there
const locate = sel => c.ev(`(()=>{for(const e of document.querySelectorAll(${JSON.stringify(sel)})){const b=e.getBoundingClientRect();for(const [fx,fy] of [[.5,.5],[.3,.3],[.7,.7],[.5,.2],[.2,.5],[.8,.5]]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(x<2||y<2||x>innerWidth-2||y>innerHeight-2)continue;const t=document.elementFromPoint(x,y);if(t&&(t===e||e.contains(t)))return {x,y};}}return null})()`);
async function hit(sel, tries = 90) { for (let i = 0; i < tries; i++) { const p = await locate(sel); if (p) { await c.click(p.x, p.y); return p; } await c.sleep(500); } return null; }
const has = (sel, cls) => c.ev(`!!document.querySelector(${JSON.stringify(sel)})?.classList.contains('${cls}')`);
async function oneShot(name, clickSel, targetSel, cls) {
    const p = await hit(clickSel); if (!p) return ok(name, false, 'never clickable');
    await c.sleep(60); const on = await has(targetSel, cls);
    ok(name, on, `clicked ${clickSel} at ${Math.round(p.x)},${Math.round(p.y)} -> .${cls}`);
}
// sun / night
await hit('[data-act=sun] .disc'); await c.sleep(1500);
let night = await c.ev(`[document.getElementById('scene').classList.contains('night'), getComputedStyle(document.querySelector('.veil')).opacity, getComputedStyle(document.querySelector('.lights')).opacity, getComputedStyle(document.querySelector('.stars')).opacity]`);
ok('sun -> night (veil, lights, stars fade in)', night[0] && +night[1] > 0.7 && +night[2] == 1 && +night[3] == 1, night.join(' '));
await c.shot('/tmp/sc/t-night.png');
await hit('[data-act=sun] .disc'); await c.sleep(1500);
night = await c.ev(`[document.getElementById('scene').classList.contains('night'), getComputedStyle(document.querySelector('.veil')).opacity]`);
ok('sun -> day again', !night[0] && +night[1] == 0, night.join(' '));
// ship, clicked on one of its containers
const fills0 = await c.ev(`[...document.querySelectorAll('[data-act=ship] .crate')].map(e=>e.getAttribute('fill')).join()`);
const x0 = await c.ev(`document.querySelector('[data-act=ship] path[d^="M0 0H152"]').getBoundingClientRect().x`);
const p = await hit('[data-act=ship] .crate');
await c.sleep(50);
ok('ship: click on a deck container starts the ship', await has('[data-act=ship]', 'sail'));
ok('ship: that container was not repainted by the click', fills0 === await c.ev(`[...document.querySelectorAll('[data-act=ship] .crate')].map(e=>e.getAttribute('fill')).join()`));
const xs = []; const t0 = Date.now();
for (let i = 0; i < 58; i++) {
    xs.push([Date.now() - t0, await c.ev(`document.querySelector('[data-act=ship] path[d^="M0 0H152"]').getBoundingClientRect().x`)]);
    if ([5, 15, 25, 40, 50].includes(i)) await c.shot(`/tmp/sc/t-sail-${i}.png`);
    if (i === 10) { await c.click(p.x + (xs[i][1] - x0), p.y); }   // second click while under way
    await c.sleep(200 - (Date.now() - t0) % 200);
}
const steps = xs.slice(1).map((v, i) => (v[1] - xs[i][1]) / (v[0] - xs[i][0]) * 1000);       // px/s
const sr0 = await c.ev(`document.getElementById('scene').getBoundingClientRect().right`);
const acc = steps.slice(1).map((v, i) => xs[i + 2][1] < sr0 && xs[i][1] < sr0 ? Math.abs(v - steps[i]) : 0);   // judged only while the ship is in view
const maxX = Math.max(...xs.map(v => v[1])), sceneRight = await c.ev(`document.getElementById('scene').getBoundingClientRect().right`);
console.log('  ship x (every ~200ms):', xs.map(v => Math.round(v[1])).join(' '));
ok('ship: sails right, clear of the frame', maxX > sceneRight, `max x ${Math.round(maxX)} vs frame right ${Math.round(sceneRight)}`);
ok('ship: never moves left of its berth (old bug: ploughed into the quay)', Math.min(...xs.map(v => v[1])) > x0 - 3, `min ${Math.round(Math.min(...xs.map(v => v[1])))} berth ${Math.round(x0)}`);
ok('ship: motion is smooth while in view (no jumps)', Math.max(...steps.map(Math.abs)) < 260 && Math.max(...acc) < 90, `peak speed ${Math.round(Math.max(...steps.map(Math.abs)))}px/s, largest change between samples ${Math.round(Math.max(...acc))}px/s`);
await c.sleep(800);
const x1 = await c.ev(`document.querySelector('[data-act=ship] path[d^="M0 0H152"]').getBoundingClientRect().x`);
ok('ship: back at the berth, reaction cleared', Math.abs(x1 - x0) < 3 && !(await has('[data-act=ship]', 'sail')), `x ${Math.round(x0)} -> ${Math.round(x1)}`);
ok('ship: came back with different cargo', fills0 !== await c.ev(`[...document.querySelectorAll('[data-act=ship] .crate')].map(e=>e.getAttribute('fill')).join()`));
await hit('[data-act=ship] path[d^="M0 0H152"]'); await c.sleep(60);
ok('ship: click on the hull also starts it', await has('[data-act=ship]', 'sail'));
// crates
for (const [name, sel] of [['yard crate repaints', '.layer > .crate'], ['train container repaints', '.train .crate'], ['crane load repaints', '.hoist .crate']]) {
    const before = await c.ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.getAttribute('fill')).join()`);
    const q = await hit(sel); await c.sleep(60);
    ok(name, !!q && before !== await c.ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.getAttribute('fill')).join()`));
}
const tf = await c.ev(`document.querySelector('[data-act=truck] .crate').getAttribute('fill')`);
await oneShot('truck honks and hops (clicked on its container)', '[data-act=truck] .crate', '[data-act=truck]', 'hop');
ok('truck container not repainted', tf === await c.ev(`document.querySelector('[data-act=truck] .crate').getAttribute('fill')`));
await oneShot('rickshaw honks and hops', '[data-act=rickshaw] path', '[data-act=rickshaw]', 'hop');
await oneShot('locomotive sounds and hops', '[data-act=train] path', '[data-act=train]', 'hop');
await oneShot('plane loops', '[data-act=plane] path', '[data-act=plane]', 'loop');
await oneShot('cloud puffs', '[data-act=cloud] path', '[data-act=cloud]', 'puff');
await oneShot('wind turbine whirls', '[data-act=turbine] circle', '[data-act=turbine]', 'whirl');
await oneShot('drone wobbles', '[data-act=drone] path', '[data-act=drone]', 'wobble');
await oneShot('factory huffs', '[data-act=works] path', '[data-act=works]', 'huff');
await c.sleep(400); ok('factory steam visible mid-puff', +(await c.ev(`getComputedStyle(document.querySelector('[data-act=works] .steam')).opacity`)) > 0.2);
await oneShot('wild flower pops', '[data-act=flower] ellipse', '[data-act=flower]', 'pulse');
ok('wild flower throws petals', await c.ev(`document.querySelectorAll('.petal-bit').length`) > 0);
await c.sleep(1300);
await oneShot('rainbow flower spins', '[data-act=hero] path', '[data-act=hero]', 'spin-once');
ok('rainbow flower throws petals', await c.ev(`document.querySelectorAll('.petal-bit').length`) >= 14);
await c.sleep(1300); ok('petals cleaned up', await c.ev(`document.querySelectorAll('.petal-bit').length`) === 0);
// hover rustle, parallax
const sw = await locate('.sway path');
await c.move(sw.x - 40, sw.y); await c.move(sw.x, sw.y); await c.sleep(80);
ok('plants rustle on hover', await c.ev(`!!document.querySelector('.sway.rustle')`));
await c.move(40, 300); await c.sleep(900);
const tA = await c.ev(`document.querySelector('[data-depth="28"]').style.transform`);
await c.move(W - 40, 300); await c.sleep(900);
const tB = await c.ev(`document.querySelector('[data-depth="28"]').style.transform`);
ok('parallax follows the pointer', tA !== tB && /translate/.test(tB), `${tA} -> ${tB}`);
// sound toggle
const tg = await locate('.sound-toggle'); await c.click(tg.x, tg.y); await c.sleep(60);
const off = await c.ev(`[document.querySelector('.sound-toggle').getAttribute('aria-pressed'), localStorage.getItem('sound')]`);
await hit('[data-act=cloud] path'); await c.sleep(60);
await c.click(tg.x, tg.y); await c.sleep(60);
const onv = await c.ev(`[document.querySelector('.sound-toggle').getAttribute('aria-pressed'), localStorage.getItem('sound')]`);
ok('mute toggle off / on', off.join() === 'false,off' && onv.join() === 'true,on', off + ' -> ' + onv);
const errs = c.logs.filter(l => !/favicon/.test(l));
ok('no console errors or exceptions', errs.length === 0, errs.join(' | '));
console.log(`\n${res.filter(r => r[1]).length}/${res.length} passed`);
await c.close();
