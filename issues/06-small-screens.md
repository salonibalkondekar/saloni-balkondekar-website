# 06. Port band is cropped off on phones

Below 1000 px the painting stacks above the text at 46vh. The SVG uses
`preserveAspectRatio="xMidYMax slice"`, so only the bottom of the canvas shows: at 500 px
wide that is the inland band and meadow. The port, which carries the supply-chain story,
is cut off.

At 1512x900 the top 216 units of the 1080-unit canvas are also cropped; the sun and plane
were moved down to stay visible.

## Where

- Panel sizing: `.right-section` and `.scene` rules in `src/styles.css`.
- `preserveAspectRatio` is set where the SVG is assembled, near the end of `src/scene.js`.

## Options

- On small screens show the whole painting at its natural ratio (taller panel).
- Or anchor the crop to the middle so both bands are partly visible.

The layout was last checked at 1512, 1280, 1100 and 500 px. Headless Chrome on macOS will
not render narrower than about 500 px, so true phone widths need a real device or DevTools.
