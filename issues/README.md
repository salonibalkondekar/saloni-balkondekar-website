# Open issues: Saloni's site

Static site, no build step. Branch `improve-step-by-step`, all work uncommitted.

## Run and check

```sh
python3 -m http.server 5174 --bind 127.0.0.1   # then open http://localhost:5174
```

Headless screenshot of the page:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1512,900 --virtual-time-budget=4000 \
  --screenshot=/tmp/page.png http://localhost:5174/
```

`tools/check-painting.mjs` drives real mouse clicks over the Chrome DevTools protocol and
asserts each interaction of the current painting (14 checks passed on 2026-11-15):

```sh
node issues/tools/check-painting.mjs http://localhost:5174/ /tmp   # writes day, hover, night, train, sail PNGs
```

`tools/clicks.mjs` tested the earlier code-drawn scene and no longer applies.

## Files

| File | What it holds |
|---|---|
| `index.html` | page markup and copy |
| `src/styles.css` | layout and type, measured from the reference (leerob.com) at 1512x900 |
| `src/painting.svg` | the base painting, viewBox `0 0 816 1488`: sky, clouds, two towns, bushes, hill, wheat. Copied unmodified from the reference |
| `src/scene.js` | loads `painting.svg` inline, removes its landmark buildings by index and draws the port, ship, silos, water tower, chimneys, train, plane, sun and night layer in their place |
| `src/scene.css` | hover wind, painting animations, night mode and one-shot click reactions |
| `src/play.js` | sample playback, click handlers (`ACTS`), parallax, petal burst, mute toggle |
| `issues/old/` | the earlier fully code-drawn scene (`scene.js`, `scene.css`, `play.js`), kept for reference |
| `src/script.js` | mouse glow only |
| `sounds/` | six CC0 samples and `CREDITS.md` |
| `og.png` | link-preview image, 1200x630 |

## Rules that came from the owner

- Painting: bright gouache illustration, AI x supply chain, no text labels, no landmarks.
- Interactions stay subtle. Sounds only on click, never on hover; the mute toggle must keep working.
- Artwork: on 2026-11-15 the owner chose to build on the reference painting from leerob.com (see 04). It has no licence, so permission is still needed before launch (see 07). Do not copy audio from leerob.com or joshwcomeau.com.
- Keep the navy background, mouse glow, glass buttons and hover sweeps.
- Plain HTML/CSS/JS. No libraries, no build step.

## Issues

| # | Issue | Status |
|---|---|---|
| [01](01-plane-behind-sun.md) | Plane flies behind the sun and does a 360 when clicked | fixed: the plane flies above the sun and wobbles on click |
| [02](02-rainbow-flower-too-big.md) | Rainbow flower is too big and out of place | gone: the foreground is the reference's wheat and flowers |
| [03](03-train-jumps-no-sound.md) | Train jumps on click and makes no sound | fixed: one short locomotive horn and a puff of steam; needs a listen (05) |
| [04](04-painting-below-reference.md) | Painting still below the reference's quality | rebuilt on the reference painting; owner to judge |
| [05](05-sounds-unverified.md) | Sounds not yet heard by anyone | open |
| [06](06-small-screens.md) | Port band is cropped off on phones | fixed: sun, port, town and train all show at 390 px |
| [07](07-before-launch.md) | Facts to confirm with Saloni, domain, Vercel steps, artwork permission | open |
