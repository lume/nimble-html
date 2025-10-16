This project uses:

- Plain JavaScript with type definitions via JSDoc types. The source code runs as-is in any browser.
- TypeScript for type checking and producing type declaration files to enable type checking in downstream projects.
- `@web/test-runner` for browser-based testing

This keeps the code easy to manage and consume: no build is required to use the
code in a browser, and type checking is optional for consumers, although many
IDEs provide some type checking and intellisense for plain JS (with JSDoc types)
out of the box with zero config.

# Commands overview

```bash
# This is not required for plain JS usage. It generates type declaration files only, while performing a type check.
npm run build

# Type check only
npm run typecheck

# Type check in watch mode
npm run typecheck:watch

# Run tests (includes build)
npm test

# Watch tests (no build)
npm run test:watch
```

# Installing pre-defined dependencies

Always run `npm clean-install` to install pinned-version dependencies based on
the repo's lock file.

# Installing new dependencies

Do not install any new dependencies.

# Testing

Run `npm test` to test everything. This runs the build, checks code formatting,
and finally runs unit tests. Never run any other test command than `npm test`.

When writing new tests, always follow the format in `html.test.js` as a
reference, using `describe` and `it` functions to describe unit tests.

# Best Practices

- Don't constantly re-create RegExp objects, put them in a variable outside of
  functions so they are only created once (f.e. at the top level scope of the
  module).
- Always aim for the simplest _readable, understandable_ solution.
  - If you're adding too much code, you might be solving the problem in a too complex way.
  - Put re-usable code in functions, always avoid duplication.
  - Don't use complex one-liners or clever bit fiddling unless it is absolutely
    necessary for something like solving a performance _problem_, prefer multiple
    simple readable lines.
  - Don't prematurely optimize, always prefer readable code first.
  - Document your code with JSDoc comments. All functions, methods, and classes
    should have JSDoc comments.
- Avoid unnecessary braces. For example for conditional or loop blocks with a single statement, prefer:
  ```js
  if (condition) doSomething()
  ```
  instead of:
  ```js
  if (condition) {
    doSomething()
  }
  ```
  Similar with for loops, while loops, arrow functions.
- Use new features such as optional chaining (`obj?.prop`), nullish coalescing
  (`value ?? defaultValue`), and logical assignment operators (`x ||= y`, `x &&= y`,
  `x ??= y`) when they make the code simpler and more readable.
- Always prefer `const` for variables that don't change, and `let` only for
  variables that change. Never use `var` unless absolutely necessary for special
  hoisting reasons.
- Always prefer for-of over items.forEach
- Always prefer `element.remove()` instead of `element.parentNode.removeChild(element)`.
- Always prefer `parentElement.append(childElement)` instead of
  `parentElement.appendChild(childElement)`.
- Always prefer `parentElement.append(...childElements)` instead of
  `childElements.forEach(child => parentElement.appendChild(child))`.
- Always prefer `parentElement.prepend(childElement)` instead of
  `parentElement.insertBefore(childElement, parentElement.firstChild)`.
- Always prefer `element.replaceWith(newElement)` instead of
  `element.parentNode.replaceChild(newElement, element)`.
