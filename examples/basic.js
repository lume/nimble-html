import {html} from '../html.js'

let value = 0

const increment = () => {
	value++
	template()
}

setInterval(increment, 1000)

const key = Symbol()

const template = () => {
	return html`
		<div>
			<h1>value: ${value}</h1>

			<br />

			<button .onclick=${increment}>Increment!</button>
		</div>

		<style>
			body {
				display: flex;
				justify-content: center;
				align-items: center;
				height: 100%;
				margin: 0;
				font-family: system-ui, sans-serif;
			}
		</style>
	`(key)
}

document.body.append(...template())
