/** @import {TemplateNodes} from '../../html.js' */

// This import of solid-js currently doesn't work with web-test-runner. https://github.com/modernweb-dev/web/issues/2985
// import {createEffect, createSignal} from 'solid-js'
// import {html} from '../../html.js'

// So instead we use dynamic import with eval to avoid WTR's default code
// transform from messing with the imports.
const {createEffect, createSignal} = /** @type {typeof import('solid-js')} */ (await eval('import("solid-js")'))
const {html} = /** @type {typeof import('../../html.js')} */ (await eval('import("../../html.js")'))
export {} // Tell TS this is a module so that top-level await ^ statements show no type error.

/**
 * A helper to create an HTML template that automatically re-renders when Solid
 * signal dependencies change.
 *
 * @param {() => (key: any) => TemplateNodes} fn
 * @returns {TemplateNodes}
 */
function htmlEffect(fn) {
	/** @type {TemplateNodes} */
	let ret

	const key = Symbol('🔑')

	// Re-run the given template function whenever dependencies from fn change.
	createEffect(() => (ret = fn()(key)))

	// Return the nodes for referencing. The effect will keep them updated.
	// @ts-ignore
	return ret
}

describe('solid.js htmlEffect example', () => {
	it('basic usage example', () => {
		const [count, setCount] = createSignal(0)

		const key = Symbol()
		const template = () =>
			html`
				<div>
					<p>Count: ${count()}</p>
					<button id="increment-btn" .onclick=${() => setCount(count() + 1)}>Increment</button>
				</div>
			`(key)

		// Any time dependencies used in the template change, the template will re-render
		createEffect(() => template())

		const div = /** @type {HTMLDivElement} */ (template()[0])
		document.body.appendChild(div)

		const button = /** @type {HTMLButtonElement} */ (div.querySelector('#increment-btn'))
		const p = /** @type {HTMLParagraphElement} */ (div.querySelector('p'))

		// Initial state
		if (p.textContent !== 'Count: 0') throw new Error('Initial count should be 0')

		// Simulate button click
		button.click()

		// Updated state
		// @ts-ignore
		if (p.textContent !== 'Count: 1') throw new Error('Updated count should be 1')

		div.remove()
	})

	it('previous example simplified with htmlEffect abstraction', () => {
		const [count, setCount] = createSignal(0)

		// Any time dependencies used in the template change, the template will re-render.
		// Note how, unlike with Solid's `html` function, we don't need to wrap
		// event handlers or values in functions here because `htmlEffect`
		// re-runs the template.
		const [div] = /** @type {[HTMLDivElement]} */ (
			htmlEffect(
				() => html`
					<div>
						<p>Count: ${count()}</p>
						<button id="increment-btn" .onclick=${() => setCount(count() + 1)}>Increment</button>
					</div>
				`,
			)
		)

		document.body.append(div)

		const button = /** @type {HTMLButtonElement} */ (div.querySelector('#increment-btn'))
		const p = /** @type {HTMLParagraphElement} */ (div.querySelector('p'))

		// Initial state
		if (p.textContent !== 'Count: 0') throw new Error('Initial count should be 0')

		// Simulate button click
		button.click()

		// Updated state
		// @ts-ignore
		if (p.textContent !== 'Count: 1') throw new Error('Updated count should be 1')

		div.remove()
	})
})
