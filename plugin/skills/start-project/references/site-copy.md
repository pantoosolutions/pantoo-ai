# Site copy → `context/copy.md`

UI projects only. It records how each language is written, so builds and proofreads have
something to check against. Without it, a translation keeps the source language's phrasing and
regional spellings and terms drift between pages.

When the file is missing, copy `${CLAUDE_PLUGIN_ROOT}/templates/context/copy.md` and replace
`{{PROJECT_NAME}}` if present.

First ask which languages the product shows, and which one the text is written in first. Then, for
**each** language, ask in one batch, each with your recommended answer:

1. **Variant:** the regional form (US or UK English). Recommend the one the main audience reads.
2. **Register:** how formal, the form of address (tú or usted, du or Sie) and, in English,
   contractions yes or no.
3. **Company name as written:** capitals, spacing, accents, any legal suffix, and whether it's
   ever translated or shortened.
4. **Glossary:** 5 to 10 terms the business repeats (what it sells, its customers, its process).
   Draft them from `overview.md`, `PRODUCT.md` and, in an existing project, the strings in the
   code. For each: the meaning, the word to write, and the words not to use for it.

- **Existing text is evidence, not the answer.** Where it mixes variants, registers or terms,
  show the counts and ask which one wins. Strings that break the answer go to
  `known-issues.md` (when the project has one), unchanged.
- One section per language, the first one included. The same meaning gets a row in every
  language.
- An unanswered item is `{{TBD: what blocks it}}`.
