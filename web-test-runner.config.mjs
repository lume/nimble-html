import {importMapsPlugin} from '@web/dev-server-import-maps'

export default {
	files: 'test/**/*.test.js',
	nodeResolve: true,

	plugins: [
		importMapsPlugin({
			inject: {
				importMap: {
					'solid-js': 'https://cdn.jsdelivr.net/npm/solid-js@1.9.9/dist/solid.js',
					'solid-js/store': 'https://cdn.jsdelivr.net/npm/solid-js@1.9.9/store/dist/store.js',
				},
			},
		}),
	],
}
