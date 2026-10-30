# Browser checks: set up Playwright once

Read when a web project has no Playwright yet and the developer agreed to add it. Scripts print
only what they find, so a UI check costs a line of text, not a screenshot per step.

| Way to check UI | What lands in context |
| --- | --- |
| Playwright script via Bash | Only what the script prints |
| Claude in Chrome screenshots or `read_page` | An image per step, or the whole accessibility tree |
| Playwright MCP | A page snapshot after almost every action: never use it |

Scripts also emulate real viewports; Chrome's `resize_window` reports success and changes nothing.

## Setup

1. Dev dependency, one browser: `npm install -D @playwright/test && npx playwright install chromium`.
   Add it to the approved dependencies in `context/standards.md`.
2. `playwright.config.ts` at the root:
   - `reporter: "line"`, `screenshot: "only-on-failure"`, `trace: "retain-on-failure"`,
     `outputDir: "./e2e/.results"`.
   - **Projects are screens, not browsers:** `phone` (`devices["Pixel 7"]`), `phone-landscape`,
     `laptop` (1280×800), `monitor-2k` (2560×1440). Add WebKit only when an iOS bug needs it.
   - `webServer` with `reuseExistingServer: true`, so it uses the running dev server.
   - Env without dotenv (Node 20.12+): `process.loadEnvFile(".env.local")` in a try/catch.
3. Sign in without passwords in a setup project (`e2e/session.setup.ts`; every screen project has
   `dependencies: ["setup"]`) that saves `storageState` files the specs reuse:
   - Supabase: `auth.admin.generateLink({ type: "magiclink", email })` with the **local** secret key,
     then open the app's token-hash confirm route.
   - App-signed cookies: sign them with the local secret the way the server does, then
     `context.addCookies`.
   - **Refuse any non-local host** before using a secret key (hostname `127.0.0.1` or `localhost`).
4. `.gitignore`: `/e2e/.auth/`, `/e2e/.results/`, `/e2e/scratch/`, `/playwright-report/`.
5. `package.json`: `"e2e": "playwright test"`. Document any `E2E_*` variable in `.env.example`.
6. `AGENTS.md` → Commands: `npm run e2e` (one screen: `--project=phone-landscape`); throwaway
   checks go in `e2e/scratch/`, ignored by git.
7. Write one real spec now, to prove the setup works.

## Use

- Assert measurements, not pixels: `boundingBox()`, `getComputedStyle`, `matchMedia`,
  `scrollWidth - clientWidth` for sideways overflow.
- Throwaway check: write `e2e/scratch/<name>.spec.ts` that `console.log(JSON.stringify(...))`s the
  numbers needed, run
  `npx playwright test e2e/scratch/<name>.spec.ts --project=phone 2>&1 | grep -E '^\{|passed|failed'`,
  then delete it.
- Open a screenshot only when a test fails or a visual judgement truly needs one.
- Keep it out of CI until the local database can be seeded there.

## Gotchas

- A dev server started before a CSS config change serves stale CSS. If a layout check fails
  oddly, test the production build on another port and point `E2E_BASE_URL` at it.
- An emulated phone viewport is still the desktop engine: it checks layout, not phone speed.
