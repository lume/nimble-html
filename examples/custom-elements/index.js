import {html} from '../../html.js'
import {Base} from './Base.js'
import './cool-counter.js'

class CustomElementExample extends Base {
	template() {
		return html`
			<div>
				<h1>Custom elements!</h1>

				<cool-counter></cool-counter>

				<cool-counter .value=${101}></cool-counter>

				<!-- Unlike Lit, this works too! -->
				<cool-counter .value="202"></cool-counter>
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
