import {html} from '../../html.js'
import {Base} from './Base.js'
import './cool-counter.js'

class CustomElementExample extends Base {
	#values1 = [10, 20, 30, 40, 50]
	#values2 = [1, 2, 3, 4, 5, 6, 7, 8]
	#useValues1 = true

	connectedCallback() {
		setInterval(() => {
			console.log(' ---------------- Toggling values array ---------------- ')
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

				<!-- Static property-set syntax! (doesn't work in Lit) -->
				<cool-counter .value="202"></cool-counter>

				<hr style="width: 100%" />

				<h1>Inside dynamic nested array mappped template:</h1>

				<ul>
					${(this.#useValues1 ? this.#values1 : this.#values2).map(
						v => html`
							<li>
								Value: ${v}
								<cool-counter .value=${v}></cool-counter>
							</li>
						`,
					)}
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
				li {
					margin-bottom: 1em;
				}
			</style>
		`
	}
}

customElements.define('custom-element-example', CustomElementExample)
