import {importMapsPlugin} from '@web/dev-server-import-maps'
/** @import {TestRunnerConfig} from '@web/test-runner' */

/** @type {TestRunnerConfig} */
export default {
	files: 'test/**/*.test.js',
	nodeResolve: true,

	plugins: [
		importMapsPlugin({
			inject: {
				importMap: {
					imports: {
						'solid-js': 'https://cdn.jsdelivr.net/npm/solid-js@1.9.9/dist/solid.js',
						'solid-js/store': 'https://cdn.jsdelivr.net/npm/solid-js@1.9.9/store/dist/store.js',
						'solid-js/web': 'https://cdn.jsdelivr.net/npm/solid-js@1.9.9/web/dist/web.js',
						'solid-js/html': 'https://cdn.jsdelivr.net/npm/solid-js@1.9.9/html/dist/html.js',
					},
				},
			},
		}),
	],
}
