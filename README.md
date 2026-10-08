# Calorie Tracker

Personal calorie and macro tracker, built as a React + TypeScript PWA. See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Current state: Milestone 4, weight and water

- **Body tab:** three sections.
  - **Weight:** log a weight for any day (one per day; logging a day again replaces it). Shows the latest weight, the 7-day average and its change over 7 and 30 days, a chart with weigh-ins as dots and the 7-day average as a line (tap or use the arrow keys to read a point, 30 days / 90 days / All), weekly averages (Monday to Sunday) and a history you can correct or delete (with Undo).
  - **Water:** one-tap buttons for your containers (Shaker 250 ml, Sport bottle 900 ml, Stanley 1,100 ml by default), a custom amount, the day's entries, and the last 7 days against your goal. Goal and buttons are editable once your targets are set up (they are stored with your profile). The diary also has a compact water card.
  - **Targets:** enter sex, date of birth, height, weight, activity level and goal (cutting, maintenance or bulking). The app estimates daily calories with Mifflin-St Jeor, sets protein (2 g/kg) and fat (0.9 g/kg), and gives the rest to carbs. Calorie adjustment and the per-kg values can be fine-tuned. These are estimates, not medical advice.
- **Meals:** build a recipe from ingredients (any food, in grams), say how many servings it makes, and log portions of it in one tap, from the Meals tab or from + Add in the diary. Logging a meal records one diary entry with its macros at that time; later edits to the recipe or its ingredients do not change past days.
- **Diary:** pick a day, see calories, protein, carbs, fat, fiber, sugar and salt against your targets (progress bars, calories left or over), grouped by breakfast, lunch, dinner and snacks. Tap an entry to change its amount or meal; deleting offers Undo.
- **Add food:** search your saved foods first, then bundled **basic foods** (about 100 everyday ingredients with Czech names: meat, fish, eggs, dairy, grains, vegetables, fruit, nuts), then Open Food Facts for packaged products. Scan a barcode, type the digits, or scan from a photo. Amounts in grams, millilitres or servings, with live macros.
- **Custom foods:** products missing from Open Food Facts, or missing values, are completed once and found instantly next time. A **Foods** tab lets you edit or delete saved foods.
- **Offline-first:** everything is stored in IndexedDB (Dexie). The app shell and barcode decoder are cached, so the diary, saved foods and custom foods work offline. Online search and barcode lookup need a connection.
- **Backup:** More, then Export data, saves all tables as JSON.
- **Basic foods are approximate:** the values in `src/data/genericFoods.ts` are reference values typed from general knowledge of standard tables (mainly USDA), not checked line by line against a database. Check anything you rely on heavily, and edit a saved food in the Foods tab to correct it.
- Not yet built: cloud sync, the adaptive calorie target. See [docs/DESIGN.md](docs/DESIGN.md).

## Look and feel

Yellow on black with dark-grey surfaces, dark mode only. All colours are tokens in `src/index.css` (`@theme`), so changing the palette is a one-file edit. The app shell is pinned to the screen (`position: fixed`): the screen area scrolls and the tab bar sits below it. The page itself is deliberately one pixel scrollable (`.scroll-spacer`), because on iOS home-screen apps a page that cannot scroll gets a viewport shorter than the screen by the status-bar height, which left a gap under the tab bar. `src/platform/viewport.ts` adds a narrow fallback for that case. More, Display shows the measurements.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173, also reachable on your LAN
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm test           # unit tests (domain logic, parsing, database layer)
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

## Trying the latest version on the iPhone

Redeploy by pushing to the branch Cloudflare builds from, then reopen the app from the Home Screen (the service worker updates itself; close and reopen once if you still see the old version).

1. Search a food you eat ("ovesné vločky") and log it. Check the Open Food Facts results and whether the macros look right.
2. Scan a product, log it with servings, and check its fiber, sugar and salt.
3. Create a custom food for something Open Food Facts lacks, and log it again from search.
4. Edit an entry's amount, delete one and use Undo, then flip between days.
5. In airplane mode, log a saved food. Then close and reopen the app and confirm the data is still there.
6. More, Export data: check that the share sheet or a file download works on iOS.
7. Targets tab: enter your details and check the numbers against what you expect (about 2,540 kcal, 174 g protein for 87 kg, cutting).
8. Meals tab: build a meal you eat, log one serving from the Meals tab and another from + Add, then change the servings of a logged entry.
9. Body, Water: tap your three container buttons, remove one entry, change the goal or a button in Water settings.
10. Body, Weight: log today's weight and a few past days, read points on the chart by touch, correct one from History.
