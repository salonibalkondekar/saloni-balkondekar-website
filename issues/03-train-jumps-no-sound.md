# 03. Train jumps on click and makes no sound

Owner: "the train jumps and no sound? that doesn't look good"

![](img/03-train.png)

## What happens

Clicking the freight train makes the whole train hop off the track, silently.

## Cause

`train(el) { react(el, 'hop', 600); }` in `src/play.js:119`. `hop` is the same reaction the
truck uses (`src/scene.css:10`). The train was made silent on purpose when the sound set was
cut to five samples, so it now has motion without a matching sound.

The train group is built at `src/scene.js:322`.

## Fix

A train should not jump. Pick one:

- Give it a train reaction: a short forward lurch along the track, or a puff of steam/smoke
  from the locomotive, plus a train horn or bell sample.
- Or make it non-interactive (remove `data-act="train"` and the pointer cursor).

If adding a sample: CC0 or public domain only, processed like the others (mono, trimmed,
faded, peak about -11 dBFS), added to `FILES` in `src/play.js:5` and to `sounds/CREDITS.md`.

Check the same pattern elsewhere: rickshaw, drone, turbine, cloud and factory also react
without sound. That was intended, but any reaction that looks like a jump should be reviewed.

## Done when

- The train never leaves the rails.
- Either it has a fitting sound and motion, or it does not respond to clicks at all.
