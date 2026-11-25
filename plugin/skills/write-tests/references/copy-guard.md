# copy-guard: a check generated from `context/copy.md`

A test that fails when a user-facing string breaks a rule that can be matched as text. It catches
the mechanical slips on every run. It doesn't judge phrasing; the proofread in `verify-feature`
and `review-change` does.

## Where it goes

In the project's runner, as one test file. No runner, by choice → offer a script added to the
project's check command, and ask before editing the manifest.

The rules are **written into the check**. It never reads `context/` when it runs, and its comments
cite no path in it (`standards.md` → Code stands on its own). When `copy.md` changes, regenerate
the lists.

## What goes in, per language

| From `copy.md` | Rule |
| --- | --- |
| Variant | The other variant's spellings and words, limited to ones this product could use. US English, for example: `enquir(y\|ies)`, `colour`, `flavour`, `fibre`, `organis(e\|ed\|ation)`, `centre`, `catalogue` |
| Register | Only what a pattern can tell apart. No contractions: `\b\w+(n't\|'re\|'ve\|'ll\|'m)\b` plus `it's`, `that's`, `let's`, straight and curly apostrophes. A possessive `'s` is not one. A form of address: only unambiguous words |
| Company name | Each wrong spelling, casing or spacing, matched case-sensitively |
| Glossary → Not | Each avoided word and its plural |

Skip `{{TBD}}` lines. A rule that needs judgement ("sound warm") stays with the proofread.

## What it scans

- Only the files that hold user-facing text, per language: message files, content folders, or the
  components with inline strings. Name them in the check, and fail when a path matches no file.
- In a message file, parse it and scan the values, never the keys. In source files, scan string
  literals and markup text where the runner makes that practical; otherwise whole lines, so that
  CSS `color` and identifiers don't count against a UK English rule.
- Whole words, case-insensitive (except the company name), Unicode-aware for accented letters.
- An allowlist of exact strings with a reason each: quotes, proper names, legal text.

Report every hit as `path:line (or key): found "<word>", write "<term>"`, with paths in `/` form,
then fail once.

## Prove it

Plant one violation per rule type, see each reported, remove them. Then run it on the real strings:
a hit is a bug in the copy (leave the test failing, list it under Bugs found) or a pattern that is
too wide (narrow it). Never edit the copy to make it pass.
