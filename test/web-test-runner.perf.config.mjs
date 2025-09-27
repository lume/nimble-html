import config from './web-test-runner.all.config.mjs'
/** @import {TestRunnerConfig} from '@web/test-runner' */

/** @type {TestRunnerConfig} */
export default {
	...config,

	// only performance tests
	files: 'test/perf/**/*.test.js',
}
