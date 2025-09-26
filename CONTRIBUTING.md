# Installing pre-defined dependencies

Always run `npm clean-install` to install pinned-version dependencies based on
the repo's lock file.

# Installing new dependencies

Do not install any new dependencies.

# Testing

Run `npm test` to test everything. This runs the build, checks code formatting,
and finally runs unit tests.

When writing new tests, always follow the format in `html.test.js` as a
reference, using `describe` and `it` functions to describe unit tests.
