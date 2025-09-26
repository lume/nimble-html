import {html} from '../../html.js'
import {Base} from './Base.js'

class CoolCounter extends Base {
	#value = 0

	get value() {
		return this.#value
	}
	set value(v) {
		this.#value = v
		this.update()
	}

	increment = () => this.value++

	template() {
		return html`
			<button .onclick=${this.increment}>Increment! (count: ${this.value})</button>

			<style>
				button {
					background: ${this.value % 2 === 0 ? 'lightblue' : 'lightgreen'};
					border: none;
					border-radius: 4px;
					cursor: pointer;
					padding: 0.5em 1em;
					font-size: 1em;
				}
			</style>
		`
	}

	connectedCallback() {
		setInterval(() => this.increment(), 1000)
	}
}

customElements.define('cool-counter', CoolCounter)

// It's *that* easy to make custom elements with declarative-reactive templates! 🤯
