import {html} from '../../html.js'
import {Base} from './Base.js'

class CoolCounter extends Base {
	#value = 0

	get value() {
		return this.#value
	}
	set value(v) {
		console.log('Setting value to', v)
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

	constructor() {
		super()
		console.log('CoolCounter constructed!')
	}

	#interval = 0

	connectedCallback() {
		console.log('CoolCounter connected!', this.value)
		this.#interval = setInterval(() => this.increment(), 500)
	}

	disconnectedCallback() {
		clearInterval(this.#interval)
		console.log('CoolCounter disconnected!')
	}
}

customElements.define('cool-counter', CoolCounter)

// It's *that* easy to make custom elements with declarative-reactive templates! 🤯
