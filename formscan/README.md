# Form Scan

Form Scan cuts each student's photo and signature out of a scanned candidate sheet and saves them as separate, correctly sized files. It was built for the Maharashtra board's "Form to Scan Photograph and Signature of Candidates" sheet, used when filling Class 10 and 12 exam forms.

It is a static website. All processing happens in the visitor's browser; scans and photos are never uploaded.

## Use it

1. Open the page and select a scanned PDF, JPG or PNG (or drop it anywhere on the page).
2. Look over the results: each student has a photo, a signature and a picture of the name as written on the sheet, so you can tell who is who. Anything marked in amber needs a look.
3. If a photo or signature is cut wrongly, press **Adjust photo** or **Adjust signature** under it, drag the box and press **Use this**. **Show only problems** hides the students that need nothing.
4. Press **Download ZIP**. It holds `photos/`, `signs/`, `names/` (the name pictures), `students.csv` and `index.html`. Files are numbered 001, 002, 003… in sheet order; open `index.html` to see, or print, which number belongs to which student. **Save photo** and **Save signature** under a student download just that one file.

The page does not read the handwritten names: the reader we tried got Marathi handwriting wrong too often to be useful.

Each student shows the size of their two files. A file that cannot be brought under the limit in Settings is marked "too big", because the portal would reject it: raise the limit or choose a smaller size.

### Settings

Changing a setting re-runs the sheets already loaded.

- **Size.** Photo and signature dimensions and file-size limits. The default is a 3.5 × 4.5 cm passport shape (350 × 450 px, up to 50 KB) and a 300 × 100 px signature up to 20 KB. Upload limits differ between boards and years, so check the portal and change these to match.
- **Sheet layout.**
  - *Find the grid automatically* reads the ruled lines, so sheets with other row and column counts work without setup.
  - *I'll set rows and columns* is for sheets whose lines are too faint to read.
  - *No grid, just find photos* finds every passport photo on any scan. It does not look for signatures or names.

## Run it locally

Serve the folder with any static file server, then open the address it prints:

```sh
python3 -m http.server 8000
```

Opening `index.html` directly from disk does not work, because browsers block the background worker on `file://` pages.

## Publish it

Upload this folder as it is to any static host (Cloudflare Pages, GitHub Pages, Netlify). There is no build step and no server code. Turn on compression if the host offers it: the first visit downloads about 12 MB (OpenCV and the PDF reader), and much less when compressed.

## Adapt it to another form

A sheet works without code changes if it has a printed outer frame, ruled lines between students, and in each cell the name at the top, a pasted photo in the middle and a signature box at the bottom.

For a different layout, the places to change are in `core.js`:

| What | Where |
|---|---|
| Name strip position (top 20% of a cell) | `scanGrid`, `sh0` and `sh1` |
| Signature box search area and shape | `findSignBox` |
| Photo edge rules | `findPhoto` |
| Fallback grid when lines cannot be read | `ROWS`, `COLS`, `HEADER` |

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.js` | The page: file input, options, results table, downloads |
| `core.js` | Image processing: straightens the sheet, finds the grid, faces, photos and signatures |
| `worker.js` | Runs `core.js` in the background and encodes the JPEGs |
| `zip.js` | Builds the ZIP |
| `yunet.onnx` | Face detection model |
| `vendor/` | OpenCV.js and pdf.js |

## Test it

```sh
node test-e2e.mjs "http://127.0.0.1:8000/index.html?src=/path/to/scan.pdf"
```

This opens the page in headless Chrome, processes the file and prints a summary. `test-node.js` runs `core.js` alone on raw page pixels.

## Limits

- Tested on one school's four-page scan and on test pages cut from it. Other scanners, lighting and handwriting may behave differently.
- An overexposed scan gives washed-out photos. Rescan at lower brightness.
- Crops adjusted by hand are remembered in the browser on that computer until "Start over" is pressed.

## Credits

OpenCV.js and pdf.js (Apache 2.0), YuNet face detector from the OpenCV Zoo (MIT).
