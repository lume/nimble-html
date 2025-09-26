import {createEffect, createSignal} from 'solid-js'
import {createMutable} from 'solid-js/store'
import {html as _html} from '../../html.js'
/** @import {TemplateNodes} from '../../html.js' */

/**
 * A SolidJS-compatible version of the html template tag function.
 * It tracks reactive dependencies used in the template and
 * re-renders the template when they change.
 *
 * @param {TemplateStringsArray} strings
 * @param  {...unknown} values
 * @returns {any}
 */
function html(strings, ...values) {
	/** @type {TemplateNodes} */
	let ret

	const key = Symbol('🔑')
	createEffect(() => {
		ret = _html(strings, ...values.map(v => (typeof v === 'function' ? v() : v)))(key)
	})

	// @ts-ignore
	return ret
}

describe('solid.js examples 2', () => {
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
