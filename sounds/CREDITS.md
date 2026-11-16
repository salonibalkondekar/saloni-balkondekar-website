# Sound credits

Every file here is cut from a recording released under CC0 1.0 (public domain
dedication), so no attribution is required. Sources are listed anyway.

| File | Used for | Source | Author | Licence |
| --- | --- | --- | --- | --- |
| `click.wav` | buttons, writing rows, mute toggle | `click_001.ogg`, Interface Sounds 1.0 — https://kenney.nl/assets/interface-sounds | Kenney | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `pop.wav` | flowers, containers | `drop_003.ogg`, Interface Sounds 1.0 — https://kenney.nl/assets/interface-sounds | Kenney | CC0 1.0 |
| `switch.wav` | sun / night toggle | `switch_002.ogg`, Interface Sounds 1.0 — https://kenney.nl/assets/interface-sounds | Kenney | CC0 1.0 |
| `ship-horn.m4a` | the container ship | "Cruise ship Albatros ship horn.ogg" — https://commons.wikimedia.org/wiki/File:Cruise_ship_Albatros_ship_horn.ogg | Tvabutzku1234 (own recording, Bremerhaven, 2012) | CC0 1.0 |
| `plane-chime.m4a` | the cargo plane | "Airplane Chime Sound Effect.ogg" — https://commons.wikimedia.org/wiki/File:Airplane_Chime_Sound_Effect.ogg | Sharelk | CC0 1.0 |
| `train-horn.m4a` | the freight train | "Nathan P5.ogg", a Nathan P5 diesel locomotive air horn — https://commons.wikimedia.org/wiki/File:Nathan_P5.ogg | HarveyHenkelmann | CC0 1.0 |

## Processing

All files: mono, 44.1 kHz, silence trimmed, short fades in and out, peak
normalised (UI sounds to -9 dBFS, ship horn to -11 dBFS, train horn to -12 dBFS, plane chime to -13 dBFS).

- `ship-horn.m4a`: 1.5 s from the middle of the second blast (13.6 s to 15.1 s),
  high-passed at 55 Hz to remove wind rumble, 0.25 s fade in, 0.55 s fade out.
- `train-horn.m4a`: 0.9 s from the steady part of the blast (16.0 s to 16.9 s),
  high-passed at 70 Hz, 0.04 s fade in, 0.4 s fade out.
- `plane-chime.m4a`: the first of the recording's two tones (0.8 s to 1.9 s),
  0.4 s fade out.
