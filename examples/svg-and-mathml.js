import {html, svg, mathml} from '../html.js'

const template = html /*html*/ `
	<div>
		<p>
			Showing SVG and MathML support. This example shows the <code>svg</code> and <code>mathml</code> template tags can
			be used to create SVG and MathML elements within HTML templates. Replacing the <code>svg</code> and
			<code>mathml</code> template tags with <code>html</code> will result in HTMLUnknownElement instances due to the
			partial templates being parsed as HTML instead of SVG or MathML.

			<style>
				code {
					color: deeppink;
					font-weight: bold;
				}
			</style>
		</p>

		<p>Regular HTML:</p>
		<div class="my-div" style="padding: 20px; border: 1px solid black;">This is a regular div</div>

		<p>SVG Elements:</p>
		<svg width="200" height="200">
			${svg /*xml*/ `
				<circle cx="100" cy="100" r="50" fill="red" />
				<rect x="50" y="50" width="100" height="100" fill="blue" opacity="0.5" />
			`}
		</svg>

		<p>MathML Elements:</p>
		<br />
		<math style="padding: 20px; border: 1px solid black;">
			${mathml /*xml*/ `
				<mfrac>
					<mi>x</mi>
					<mi>y</mi>
				</mfrac>
			`}
		</math>
	</div>
`(Symbol())

document.body.append(...template)

// Let's inspect the elements
const div = document.querySelector('.my-div')
const svgEl = document.querySelector('svg')
const circle = document.querySelector('circle')
const rect = document.querySelector('rect')
const mathEl = document.querySelector('math')
const mfrac = document.querySelector('mfrac')

console.log('Regular div:', div, div?.constructor.name) // HTMLDivElement
console.log('SVG element:', svgEl, svgEl?.constructor.name) // SVGSVGElement
console.log('Circle element:', circle, circle?.constructor.name) // SVGCircleElement
console.log('Rect element:', rect, rect?.constructor.name) // SVGRectElement
console.log('MathML element:', mathEl, mathEl?.constructor.name) // MathMLElement
console.log('mfrac element:', mfrac, mfrac?.constructor.name) // MathMLFractionElement

// Check if SVG elements are actually SVG elements
console.log('div instanceof HTMLDivElement:', div instanceof HTMLDivElement) // true
console.log('svg instanceof SVGSVGElement:', svgEl instanceof SVGSVGElement) // true
console.log('circle instanceof SVGCircleElement:', circle instanceof SVGCircleElement) // true
console.log('rect instanceof SVGRectElement:', rect instanceof SVGRectElement) // true
console.log('math instanceof MathMLElement:', mathEl instanceof MathMLElement) // true
console.log('mfrac instanceof MathMLFractionElement:', mfrac instanceof MathMLElement) // true

// Check if they're unknown elements
console.log('circle instanceof HTMLUnknownElement:', circle instanceof HTMLUnknownElement) // false
console.log('rect instanceof HTMLUnknownElement:', rect instanceof HTMLUnknownElement) // false
console.log('mfrac instanceof HTMLUnknownElement:', mfrac instanceof HTMLUnknownElement) // false
