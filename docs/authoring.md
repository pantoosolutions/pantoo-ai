# Authoring skills

- **Names are verb-noun** (`build-feature`), so they say what they do and never clash with
  built-ins (`/review`, `/init`) or other kits.
- **Every line must change behavior.** If deleting a line wouldn't change what Claude does, delete it.
- **One recommended option per question.** Ask, recommend, and let the user override.
- **State lives in files, not chat.** Read from and write to `context/`; end with a hand-off that
  suggests `/clear` so the next skill starts from disk.
- **The completion summary has a fixed shape:** headline, the next command, a heads-up only if
  there is a real one, a pointer to the file written.
- **Rare and long goes to `references/`** (or `modes/`), read only when its trigger hits.
  `SKILL.md` stands alone otherwise.
- **State a recommended model · effort in one line.** Suggest, never pin (D14).
- **Check before committing:** `npm run check`. Budgets: `SKILL.md` ≤ 120 lines, each `references/` or `modes/` file ≤ 200.
  - Skills: `name` equals the folder and is verb-noun, `description` set, no `model:` or `allowed-tools:`, a `Recommended:` line.
  - Relative markdown links resolve.
  - No machine-specific paths in `plugin/`, `rules/`, `agents-user/`, `docs/`.
  - Agent `name` equals the filename; `package.json` and `plugin.json` versions match; `hooks.json` parses and its script paths exist.
