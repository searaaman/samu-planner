# Samu's Planner

A personal planner for Samu, made with love by Ramu. React + Vite + TypeScript, frontend only.

- **Tasks**: write down what you have to do, with a category, a priority (High/Medium/Low) and a "finish by" date; tick it off when done. Undone tasks past their date show as *Left behind*.
- **Ledger**: log what you did and when (Work, Study, Sleep, Exercise, Chores, Fun, Other). Sleep runs past midnight.
- **Dashboard**: a daily love note, today's progress, when you get the most done (from tick times), sleep (usual bedtime, wake-up, hours), where your time went this week, and what was left behind.
- **Profile photo**: tap the avatar or go to Settings to pick one. It is shrunk and kept in the browser.
- JSON backup/restore. Data lives in this browser's `localStorage` only.

```bash
npm install
npm run dev
npm test
npm run build
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml` (Settings → Pages → source: GitHub Actions).
