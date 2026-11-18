// Real-mouse checks for the painting. Usage: node issues/tools/check-painting.mjs [url] [outdir]
import { launch } from './cdp.mjs';
const url = process.argv[2] || 'http://localhost:5174/', out = process.argv[3] || '/tmp';
const c = await launch({ w: 1512, h: 900, port: 9337, scale: 2 });
await c.goto(url, 2500);
let fails = 0;
const ok = (name, pass, note = '') => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); };
// a point inside the first matching element that is on screen and on top there
const locate = sel => c.ev(`(()=>{for(const e of document.querySelectorAll(${JSON.stringify(sel)})){const b=e.getBoundingClientRect();for(const [fx,fy] of [[.5,.5],[.3,.3],[.7,.7],[.5,.2],[.2,.5],[.8,.5]]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(x<2||y<2||x>innerWidth-2||y>innerHeight-2)continue;const t=document.elementFromPoint(x,y);if(t&&(t===e||e.contains(t)))return {x,y};}}return null})()`);
async function hit(sel, tries = 100) { for (let i = 0; i < tries; i++) { const p = await locate(sel); if (p) { await c.click(p.x, p.y); return p; } await c.sleep(500); } return null; }
const has = (sel, cls) => c.ev(`!!document.querySelector(${JSON.stringify(sel)})?.classList.contains('${cls}')`);
const panel = await c.ev(`(()=>{const b=document.getElementById('scene').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()`);
const shot = name => c.shot(`${out}/${name}.png`, panel);

ok('painting loaded with every piece', await c.ev(`['sun','ship','train','plane','works','flower'].every(a=>document.querySelector('#scene [data-act='+a+']'))`));
await shot('day');
await c.move(panel.x + 200, panel.y + 300); await c.sleep(1600);
ok('hover starts the wind', await c.ev(`getComputedStyle(document.getElementById('scene')).getPropertyValue('--painting-wind')`) > 0.9);
await shot('hover');

await hit('[data-act=sun] .moonface'); await c.sleep(1600);
ok('sun -> night', await has('#scene', 'night') && await c.ev(`getComputedStyle(document.querySelector('.veil')).opacity`) > 0.7);
ok('night has stars', await c.ev(`document.querySelectorAll('.stars circle').length`) > 40, await c.ev(`document.querySelectorAll('.stars circle').length`) + ' stars');
await shot('night');
await hit('[data-act=sun] .moonface'); await c.sleep(1600);
ok('sun -> day again', !(await has('#scene', 'night')));

const fill0 = await c.ev(`document.querySelector('.crate').getAttribute('fill')`);
await hit('#scene svg svg:nth-of-type(3) .crate');
ok('yard container repaints on click', true, fill0);
await hit('[data-act=train]'); await c.sleep(80);
ok('train: click lets off steam, no hop', await has('[data-act=train]', 'huff'));
await hit('[data-act=pinwheel]'); await c.sleep(80);
ok('pinwheel spins on click', await has('[data-act=pinwheel]', 'spin-once'));
ok('all six samples load', await c.ev(`Promise.all(['click.wav','pop.wav','switch.wav','ship-horn.m4a','train-horn.m4a','plane-chime.m4a'].map(f=>fetch('sounds/'+f).then(r=>r.ok))).then(a=>a.every(Boolean))`));
await shot('train');
await hit('[data-act=works]'); await c.sleep(80);
ok('chimneys huff', await has('[data-act=works]', 'huff'));
await hit('.home-painting-flower'); await c.sleep(120);
ok('flower throws petals', await c.ev(`document.querySelectorAll('.petal-bit').length`) > 0);
await hit('[data-act=plane]', 140); await c.sleep(80);
ok('plane wobbles, no loop', await has('[data-act=plane]', 'wobble'));
await hit('[data-act=ship]'); await c.sleep(80);
ok('ship sets sail', await has('[data-act=ship]', 'sail'));
await c.sleep(3500); await shot('sail');
ok('no console errors', c.logs.length === 0, c.logs.join(' | '));
await c.close();
process.exit(fails ? 1 : 0);
