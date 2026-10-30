# Web Access: cheapest tool first

| Goal | Use |
| --- | --- |
| Library or API docs | ctx7, through `docs-researcher` |
| Facts, research | WebSearch / WebFetch |
| A service that has a CLI or API (GitHub, Vercel, Supabase) | The CLI, never its dashboard |
| Check our own app's UI | Playwright scripts through `verifier` (text results) |
| Judge a design by eye | One targeted Playwright screenshot, else Claude in Chrome |
| Design data from a tool with no CLI (Figma, Penpot, Sketch, Webflow) | The tool's official MCP server from the project's `.mcp.json` (`npx pantoo-ai add source <tool>`). Read-only unless the user asks for a change |
| Logged-in pages, dashboards with no CLI | Claude in Chrome (the user's own sessions) |
| A site that refuses automated fetches or needs JavaScript | Claude in Chrome, reading it as the user would, within the site's terms. No bulk scraping |
| A desktop app | Computer use |
