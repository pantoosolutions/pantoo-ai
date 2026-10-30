# Templates

Read only the section for the type you're writing. Leave out a section that would be empty.

## pr

Title: a Conventional Commit subject under 70 characters (`feat(checkout): pay with saved cards`).

```markdown
## What

<two or three sentences: what changes for a user or a caller, not a file list>

## Why

<the problem or the slice; link the spec: context/specs/NNN-name.md>

## How

- <one bullet per meaningful decision or area, the non-obvious ones first>

## Testing

- <what was run and what it showed: the verify report, the suite, manual steps>

## Risks and follow-ups

- <migrations, flags, config to set, known gaps; "none" if none>
```

Reviewers read Why and Risks first: make them exact. No AI attribution.

## changelog

New file only (otherwise match the file):

```markdown
# Changelog

## [Unreleased]

### Added
- <a capability, in the reader's words>

### Changed
### Fixed
### Removed
### Security
```

One line per change a developer would notice. Group by type; drop empty groups. Internal refactors
appear only when they change behaviour or the API.

## release-note

```markdown
# <Product> <version>

<date>

<one paragraph: the change users will care about most, in their words>

## New
- <what you can do now>

## Improved
- <what works better, and how they'll notice>

## Fixed
- <the symptom users saw, not the cause>

## Before you upgrade
<only for breaking changes, required actions or migrations; otherwise delete>
```

No commit hashes, file names or jargon. A change users can't perceive doesn't belong here.

## postmortem

Blameless: systems and contributing factors, never people.

```markdown
# Postmortem: <short title>

<date> · severity <1–4> · status <draft | final>

## Summary
<two or three sentences: what broke, for whom, for how long, and the fix>

## Impact
<who was affected, how many, what they couldn't do, any data affected>

## Timeline (<timezone>)
| Time | Event |
| --- | --- |
| <hh:mm> | <first bad deploy, detection, mitigation, resolution> |

## Root cause
<the chain from trigger to failure, with path:line where code is involved>

## Contributing factors
- <what let it reach users or slowed the fix: missing test, alert, review gap>

## What went well
- <…>

## Action items
| Action | Owner | Tracked in |
| --- | --- | --- |
| <the regression test, the alert, the guard> | <name> | <slice, issue or known-issues row> |
```

Every timeline entry and cause comes from the developer's account or the record; unknowns stay
`{{TBD}}`.
