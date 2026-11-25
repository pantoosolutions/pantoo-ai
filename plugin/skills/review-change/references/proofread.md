# Proofread changed copy

For a change that adds or edits text users read. The proofreader gets whole strings and
`context/copy.md`, never the diff: a diff shows fragments, and the model that wrote a sentence
tends to read past its own mistakes.

## 1. Collect the strings

From the changed and untracked files: message and locale files, UI text and its attributes
(`alt`, `aria-label`, `placeholder`, `title`), page metadata, published content, emails, and the
errors a user sees. Leave out `context/`, developer docs, logs, comments and test data.

Open each file and take every changed string **whole, as it reads now**. A sentence split across
elements or keys is joined into the sentence the user sees; a variable stays as `{name}`. Give
each a `path:line`, its language and where it appears (hero heading, form error). Group them by
language, in the order a reader meets them.

No such string → no proofread; say nothing about copy. No `context/copy.md` in a UI project → no
proofread; put "copy not proofread, no `context/copy.md`: run `/pantoo:start-project`" in the
Heads-up.

## 2. Send them to a different model

Ask which model wrote the strings, unless this run already asked who wrote the code. Spawn
`deep-reviewer`: Sonnet or Haiku wrote them → its default (Opus); Opus wrote them →
`model: sonnet`; Fable → default. A developer or client wrote them → default. Never the writer's
model, never Haiku.

The prompt holds the grouped strings, the path to `context/copy.md`, and this brief, with no
diff, spec or summary of the change:

> Proofread these strings. Your task is copy only: read `context/copy.md`, then nothing else in
> the repo. Read each string as a native reader of that variant would. Report:
> - spelling or vocabulary from another variant;
> - a break in the register (form of address, contractions, formality);
> - the company name written another way;
> - a glossary term replaced by a word in its Not column, or by an unlisted synonym;
> - phrasing carried over from another language: calques, false friends, unnatural word order;
> - grammar, spelling, punctuation, or a sentence that doesn't make sense.
> A `{{TBD}}` or unfilled line in `copy.md` is no rule. For each finding give `path:line`, the
> string, what's wrong and a rewrite. Don't flag a matter of taste. A language with no section in
> `copy.md` is checked for grammar only, and you say so. Nothing found → say so.

## 3. Use the result

Report the findings and change no string: the developer picks. The proofreader failed or returned
nothing → copy is not proofread; say so, never "no findings".
