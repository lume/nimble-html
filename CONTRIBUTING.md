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

# AI only:

## Never do the following:

- Never create tests in files that you run with `node`. Our code is for
  browsers, so always run tests using `npm test` which ensures our tests run in a
  headless browser. The output is logged back to terminal.

## Responding to prompts

After every prompt, always provide at least three proposals for a solution, with
pros and cons, and stop to allow the user to select the desired direction.

A conversation should be like this:

1. User: Let's do [thing to do].
2. AI: Here are three ways we could do X:
   1. Do it this way because of A, B, C. Pros: ... Cons: ...
   2. Do it that way because of D, E, F. Pros: ... Cons: ...
   3. Do it another way because of G, H, I. Pros: ... Cons: ...
3. User: Let's go with option 2.
4. AI: Great! (AI goes and implements option 2)
5. Repeat from step 1.

Basically, _always_ confirm with three proposals before implementing anything.
