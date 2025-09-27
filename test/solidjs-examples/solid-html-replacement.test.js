import {html as _html} from '../../html.js'
/** @import {TemplateNodes} from '../../html.js' */

// This import of solid-js currently doesn't work with web-test-runner. https://github.com/modernweb-dev/web/issues/2985
// import {createEffect, createSignal} from 'solid-js'
// import {createMutable} from 'solid-js/store'

// So instead we use dynamic import with eval to avoid WTR's default code
// transform from messing with the imports.
const {createEffect, createSignal} = /** @type {typeof import('solid-js')} */ (await eval('import("solid-js")'))
const {createMutable} = /** @type {typeof import('solid-js/store')} */ (await eval('import("solid-js/store")'))
export {} // Tell TS this is a module so that top-level await ^ statements show no type error.

/**
 * An alternative to Solid's `html` template tag, with similar behavior of
 * accepting signal accessors, but with Lit's `html` syntax.
 *
 * This new `html` function is similar to the one from Solid in that it needs to
 * be called only once, and signal accessors are passed as functions to the
 * template.
 *
 * @param {TemplateStringsArray} strings
 * @param  {...unknown} values
 * @returns {any}
 */
function html(strings, ...values) {
	/** @type {TemplateNodes} */
	let ret

	const key = Symbol('🔑')

	// Re-run the template whenever its dependencies change.
	createEffect(() => {
		// Evaluate any signal accessors in the values to track them as dependencies.
		const _values = values.map(v => (typeof v === 'function' ? v() : v))

		// Apply plain values to the template.
		ret = _html(strings, ..._values)(key)
	})

	// Return the nodes for referencing. The effect will keep them updated.
	// @ts-ignore
	return ret
}

describe('solid.js custom html template tag example', () => {
	it('basic usage example', () => {
		const [count, setCount] = createSignal(0)

		const key = Symbol()
		const template = () =>
			_html`
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

	it('previous example simplified with html abstraction', () => {
		const state = createMutable({count: 0})

		// Any time dependencies used in the template change, the template will re-render.
		// Note how, similar to Solid's `html` function, we need to wrap values
		// (including event handlers) in functions here because the template is
		// only run once, and the values need to be signal accessors.
		const [div] = /** @type {[HTMLDivElement]} */ (
			html`
				<div>
					<p>Count: ${() => state.count}</p>
					<button id="increment-btn" .onclick=${() => () => state.count++}>Increment</button>
				</div>
			`
		)

		document.body.append(div)

		const button = /** @type {HTMLButtonElement} */ (div.querySelector('#increment-btn'))
		const p = /** @type {HTMLParagraphElement} */ (div.querySelector('p'))

		console.log(p.textContent, state.count)

		// Initial state
		if (p.textContent !== 'Count: 0') throw new Error('Initial count should be 0')

		// Simulate button click
		button.click()

		if (state.count !== 1) throw new Error('State count should be 1 after click')

		console.log(p.textContent, state.count)

		// Updated state
		// @ts-ignore
		if (p.textContent !== 'Count: 1') throw new Error('Updated count should be 1')

		div.remove()
	})
})
