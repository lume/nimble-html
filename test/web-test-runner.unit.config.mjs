import config from './web-test-runner.all.config.mjs'
/** @import {TestRunnerConfig} from '@web/test-runner' */

/** @type {TestRunnerConfig} */
export default {
	...config,

	// unit tests only (no performance tests)
	files: ['test/**/*.test.js', '!test/perf/**/*.test.js'],
}
