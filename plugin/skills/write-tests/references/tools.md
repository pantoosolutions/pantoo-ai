# Runner notes

Read only the section for the runner in use. Match the repo's existing test style over anything here.

## Placement

| Runner | Where | Pattern | Terse run |
| --- | --- | --- | --- |
| Vitest | beside the source | `*.test.ts(x)` | `--reporter=dot` |
| Jest | beside the source, or `__tests__/` | `*.test.ts(x)` | `--reporters=summary` |
| `node:test` | `test/` | `*.test.js` | `--test-reporter=dot` |
| Playwright | `e2e/` | `<flow>.spec.ts`, named by the flow | `--reporter=line` |
| pytest | `tests/`, mirroring the source | `test_*.py` | `-q` |
| Go | the source's package | `*_test.go` | `go test ./... ` (quiet by default) |
| Rust | `#[cfg(test)] mod tests`, or `tests/` | n/a | `cargo test -q` |

## Every runner

- Test names are sentences: "returns null when the cart is empty".
- One behaviour per test; arrange, act, assert.
- The public interface, never internals or private calls.
- Every async call awaited; no dependence on order, real time or the network.

## Vitest / Jest

- `vi.mock()` / `jest.mock()` at the top for modules; `vi.fn()` for simple doubles; `vi.spyOn()` when
  the call itself is the effect (an analytics event).
- Timers: `vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach`.
- Rejections: `await expect(fn()).rejects.toThrow('message')`.
- No `vitest.config.*` and Testing Library in use → a minimal config with `environment: 'jsdom'` and a
  setup file importing `@testing-library/jest-dom`.

## Testing Library

- Queries by role, then label, then text; test ids last.
- `const user = userEvent.setup()` before interacting; never `fireEvent`.
- `await findByRole(…)` for async UI, not `waitFor(() => getByRole(…))`.
- Accessibility: Tab order is logical; every button and input has an accessible name; errors are tied
  to their input with `aria-describedby`; a dialog traps focus and returns it on close;
  `aria-expanded` toggles. Contrast is a design review, not a test.

## Playwright

- Each test sets up its own state; `page.getByRole()` / `getByLabel()` over CSS selectors.
- Wait on assertions (`await expect(locator).toBeVisible()`), never on fixed timeouts.
- Forms: fill, submit, assert the success or the error state.
- Responsive pages: 375 px and 1280 px.
- No `playwright.config.*` → a minimal one: test dir, and `webServer` from the project's dev command.

## pytest

- Fixtures for shared setup; `@pytest.mark.parametrize` for input variations.
- `with pytest.raises(ValueError):` for errors; the `mocker` fixture (pytest-mock) for doubles.
- Async: `@pytest.mark.asyncio`.

## Go

- `Test<Func>_<scenario>`; table-driven with `t.Run(tt.name, …)`; `t.Parallel()` without shared state.
- testify: `require.NoError` to stop early, `assert.Equal(t, want, got)`.

## Rust

- `assert_eq!`; `#[should_panic(expected = "…")]`; tests returning `Result` use `?`.
