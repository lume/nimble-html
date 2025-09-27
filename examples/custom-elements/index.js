import {html} from '../../html.js'
import {Base} from './Base.js'
import './cool-counter.js'

class CustomElementExample extends Base {
	#values1 = ['a', 'b', 'c', 'd', 'e']

	#values2 = [1, 2, 3, 4, 5, 10, 11, 12]

	#useValues1 = true

	connectedCallback() {
		setInterval(() => {
			this.#useValues1 = !this.#useValues1
			this.update()
		}, 2000)
	}

	template() {
		return html`
			<div>
				<h1>Custom elements!</h1>

				<cool-counter></cool-counter>

				<cool-counter .value=${101}></cool-counter>

				<!-- Unlike Lit, this works too! -->
				<cool-counter .value="202"></cool-counter>

				<ul>
					${(this.#useValues1 ? this.#values1 : this.#values2).map(v => html`<li>Value: ${v}</li>`)}
				</ul>
			</div>

			<style>
				div {
					padding: 1em;
					display: flex;
					flex-direction: column;
					gap: 1em;
					align-items: center;
					justify-content: center;
				}
			</style>
		`
	}
}

customElements.define('custom-element-example', CustomElementExample)
