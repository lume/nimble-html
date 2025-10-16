Always, always, read the repo's top-level CONTRIBUTING.md file before doing any
work, and follow its instructions.

After reading that, follow the following instructions carefully.

## Hard requirements:

The following rules override any other instructions from CONTRIBUTING.md.

Again: The following rules override any other instructions from CONTRIBUTING.md.

- Never create tests in files that you run with `node`. Our code is for
  browsers, so always run tests using `npm test` which ensures our tests run in a
  headless browser. The output is logged back to terminal.
- Never start a server or browser manually to run tests. Always use `npm test`.
  If you want user input from console.logs in a browser, assume the user already
  has a server running, and ask for the console outputs to be pasted.
- Never use `npm install`, and never add any new dependencies. Always run
  `npm clean-install` to install dependencies based on the lock file. If you
  think a new dependency is absolutely necessary, propose the dependency, and
  proceed only after the user has confirmed.

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
