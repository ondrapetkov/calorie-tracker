# Calorie Tracker

Personal calorie and macro tracker, built as a React + TypeScript PWA. See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Current state: Milestone 1, scanner spike

A single page that answers one question: can an iPhone scan real products in Safari and look them up in Open Food Facts?

- Live camera barcode scanning (EAN-13, EAN-8, UPC-A, UPC-E) decoded in the browser with `zxing-wasm`. The decoder WASM is bundled and precached, not loaded from a CDN.
- Open Food Facts lookup, with per-100 g macros including fiber, sugar and salt (kJ converted to kcal when kcal is missing).
- Fallbacks: type the digits, or decode a barcode from a photo.
- Live diagnostics under the camera: resolution, decode time per frame, frames per second.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173, also reachable on your LAN
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

Camera access needs HTTPS or `localhost`, so testing on a phone means deploying (below) rather than opening the LAN dev URL.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub (already done for this branch).
2. In the Cloudflare dashboard go to Workers & Pages, create an application, choose Pages and connect to Git, and select this repository. The dashboard layout changes from time to time, so follow its current wording.
3. Settings:
   - Production branch: the branch you want to deploy (for now `claude/calorie-tracker-brainstorm-1fxuwf`, later `main`)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: taken from `.node-version` (22)
4. Open the resulting `https://<project>.pages.dev` URL on the iPhone in Safari.

Alternative without Git integration: `npm run build && npx wrangler pages deploy dist`.

## Test on the iPhone

1. Open the deployed URL in Safari, tap Share, then Add to Home Screen, and launch it from the new icon (this is the mode the real app will run in).
2. Tap Start camera and allow access. Scan five or six products you actually eat, in kitchen lighting. Try a small barcode, a curved can or bottle, and a shiny wrapper.
3. Note, for each: did it scan, how long did it take, and did Open Food Facts have it with sensible macros?
4. Check the diagnostics line: decode time per frame and fps.
5. Turn on airplane mode, reopen the app from the Home Screen and confirm it still loads and the camera still decodes (the lookup will fail offline, which is expected).

## What to report back

- Scan success rate and typical time to detect.
- Any camera permission or autofocus problems in the Home Screen app.
- Whether the Open Food Facts lookup works from the browser (this checks the CORS question in the design doc) and how well Czech products are covered.
