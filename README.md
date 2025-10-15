# nimble-html

A light-weight template tag library with `html`, `svg`, and `mathml` functions for writing declarative-reactive web apps.

## At a glance

```js
import {html, svg, mathml} from 'nimble-html'

const colors = ['red', 'green', 'blue']
const feeling = 'simplicity'

const key = Symbol()

const template = () => ...html`
  <ul .onclick=${() => console.log(feeling)}>
    ${colors.map(c => html`<li>${c}</li>`)}
  </ul>

  <svg width="100" height="100">
    ${colors.map((c, i) => svg` <circle cx="50 + ${i}" cy="50 + ${i}" r="40 + ${i}" fill=${c}/> `)}
  </svg>

  <math> ${colors.map((c, i) => mathml` <mfrac> <mi>${i}</mi> <mi>${c}</mi> </mfrac> `)} </math>
`(key),

document.body.append( ...template())

// Update values any time.
colors = ['cyan', 'magenta', 'yellow', 'black']
template() // updates the DOM
```

# Features

- **Zero dependencies**: Lightweight implementation using standard DOM APIs, in a [single small file](./html.js)
- **Framework-agnostic**: Works with any JavaScript framework or no framework at all
- **Multi-namespace support**: `html`, `svg`, and `mathml` template tags with proper namespace handling
- **Declarative and reactive**: Update DOM by re-invoking templates with new values
- **buildless**: No build step required, works in any modern browser as-is
- **Template caching**: Templates are cached based on source location for optimal performance
- **Instance management**: Unique keys create unique DOM instances that can be updated in place
- **Attribute and property binding**: Supports regular attributes, boolean attributes, JS properties, and event handlers
- **Case-sensitive bindings**: Property and event bindings preserve exact case for maximum compatibility
- **Type-safe**: Written in plain JavaScript with JSDoc types for TypeScript compatibility
- **Lit-compatible syntax**: Uses familiar template syntax for easy adoption

# A closer look

```javascript
import {html} from 'nimble-html'

let value = 'Hello World'

const key = Symbol() // or any unique value

// Value interpolation
const template = () => html`<div>Message: ${value}</div>`(key)

const [div] = template() // Creates and returns DOM

console.log(div instanceof HTMLDivElement) // true
console.log(div.textContent) // "Message: Hello World"

// Update values any time.
let value = 'Hello Webdev'
template() // updates the DOM

console.log(div.textContent) // "Message: Hello Webdev"
```

# Examples

- [Basic](https://rawcdn.githack.com/lume/nimble-html/c250c4f8db47d623fb4643613f1370dbac2d936f/examples/basic.html) - [source](./examples/basic.html)
- [Custom Elements](https://rawcdn.githack.com/lume/nimble-html/c250c4f8db47d623fb4643613f1370dbac2d936f/examples/custom-elements/index.html) - [source](./examples/custom-elements/index.html)

# Installation

Simply copy `html.js` to your project, or import it directly
from GitHub into your JS code (f.e. using the raw.githack.com proxy):

```html
<script type="module">
  import {html, svg, mathml} from 'https://rawcdn.githack.com/lume/nimble-html/v0.1.0/html.js'

  const feeling = 'wonderfulness'
  const [div] = html`<div>${feeling}</div>`()

  document.body.append(div)
</script>
```

If you want to keep your app import statements clean, define an importmap:

```html
<script type="importmap">
  {
    "imports": {
      "nimble-html": "https://rawcdn.githack.com/lume/nimble-html/v0.1.0/html.js"
    }
  }
</script>

<script type="module">
  import {html, svg, mathml} from 'nimble-html'

  const feeling = 'wonderfulness'
  const [div] = html`<div>${feeling}</div>`()

  document.body.append(div)
</script>
```

If you have Node.js tooling, you can also install it via `npm`:

```bash
npm install nimble-html
```

# Key Concepts (pun intended)

## Template Identity and Keying

_Template instances_ are formed by two things:

1. **Source location** - The unique template strings array from your source code
2. **Key** - A unique reference you provide for instance identity when calling the template

Each template instance has a unique DOM tree that can be updated in place by
repeatedly calling the same template with the same key.

```javascript
const key = Symbol() // A key to represent a single template instance.

function render(key, value) {
  return html`<div>Value: ${value}</div>`(key)
}

const [div1] = render(key, 'first')
document.body.append(div1)

console.log(div1.textContent) // "Value: first" - initial content

const [div2] = render(key, 'second')

console.log(div1 === div2) // true - same DOM instance!
console.log(div1.textContent) // "Value: second" - content updated

const newKey = Symbol() // A different key for a new template instance.
const [div3] = render(newKey, 'third')

console.log(div2 !== div3) // true - new DOM instance
console.log(div3.textContent) // "Value: third" - new content
```

This _key feature_ (pun intended) enables higher-level frameworks to build
different ways of managing template instances, while being simple out of the
box.

## Attribute Types

The library supports different attribute binding syntaxes:

```javascript
const value = 'dynamic'
const isEnabled = true
const clickHandler = () => console.log('clicked')

const elements = html`
  <!-- Regular attributes -->
  <div class=${value}></div>
  <div class="${value} static-class"></div>

  <!-- Boolean attributes (with ? prefix) -->
  <input ?disabled=${!isEnabled} />

  <!-- JS properties (with . prefix) -->
  <input .value=${value} />

  <!-- Event handlers (with @ prefix) -->
  <button @click=${clickHandler}>Click me</button>
`(key)
```

### Case Sensitivity for Properties and Events

Property bindings (`.prop=`) and event bindings (`@event=`) preserve exact case, allowing you to target specific JavaScript properties and events:

```javascript
const element = html`
  <div
    .customProp=${'value1'}     <!-- Sets element.customProp -->
    .customprop=${'value2'}     <!-- Sets element.customprop (different property!) -->
    @customEvent=${handler1}    <!-- Listens for 'customEvent' -->
    @customevent=${handler2}    <!-- Listens for 'customevent' (different event!) -->
  ></div>
`(key)

// Both properties are set independently
console.log(element.customProp) // 'value1'
console.log(element.customprop) // 'value2'

// Both event listeners are registered independently
element.dispatchEvent(new Event('customEvent')) // Calls handler1
element.dispatchEvent(new Event('customevent')) // Calls handler2
```

This case sensitivity is particularly important for:

- **Custom elements** with camelCase properties like `.firstName`, `.lastName`
- **Framework integration** where exact property names matter
- **Custom events** that may use different casing conventions

## Get Multiple Elements

An `html` template returns an array of nodes for convenient access:

```javascript
const elements = html`
  <div>First element</div>
  <p>Second element</p>
`(key)

console.log(elements) // [div, p]
```

A useful syntax is array destructuring to grab elements or text nodes that are
_visually_ visible at the top level of a template:

```js
const [div, button, textNode] = html`
  <div>harmony</div>
  <button>peace</button>
  ${'compassion'}
`

console.log(div.textContent) // harmony
console.log(button.textContent) // peace
console.log(textNode.data) // compassion
```

## Whitespace Handling

The template syntax is standard HTML, including all whitespace handling, except
for whitespace at the _top level_ of a template, for convenience. Top level
whitespace is trimmed out, and the list of returned nodes are those that you
_visually_ see. That's why the return value in the previous example is three
items (`[div, button, textNode]`), and not seven.

The only text nodes returned are those that are visible via an interpolation
site.

If you need white space preservation, use explicit text nodes at the top level,
or wrap text in elements:

```js
const [pre, whitespace, span, p] = html`
  <pre>   preserved      whitespace   here  </pre>

  ${'   ' /* explicit top-level whitespace */}

  <span> preserved whitespace here </span>

  <p>
    preserved whitespace here

    <span> preserved whitespace here </span>
  </p>
`
```

You _see_ four nodes, you get four nodes.

> [!Warning]
> Whitespace handling may be subject to change. Perhaps it is better to preserve
> all whitespace as-is, for consistency, while still allowing the return value to
> return _visible_ nodes only. Feedback welcome!

## Nested Templates

`html` templates can be nested inside other templates:

```javascript
function itemTemplate(name) {
  return html`<li>${name}</li>`
}

function listTemplate(key, items) {
  return html`
    <ul>
      ${items.map(item => itemTemplate(item))}
    </ul>
  `(key)
}

let items = ['apple', 'banana', 'cherry']

const myListKey = Symbol()

document.body.append(...listTemplate(myListKey, items))
```

It is not required to pass a key to nested templates, and in that case the
nested template instance will be unique per parent template instance. In other
words, for each parent template instance, there will be a single instance of a
child template at a given interpolation site unless a different key is specified
for the child template.

With that in mind, this will work as expected and will update the list items in
place when the parent `listTemplate` is called again with the same `myListKey`:

```js
items = ['avocado', 'blueberry', 'clementine']

listTemplate(myListKey, items)
```

## Event Handlers

Event handlers can be functions or strings:

```javascript
const handleClick = event => {
  console.log('Button clicked!', event.target)
}

const button = html`
  <!-- Function handler -->
  <button @click=${handleClick}>Click me</button>

  <!-- String handler (evaluated as code) -->
  <button @click="alert('Hello!')">Alert</button>
`(key)
```

The `@event=` syntax uses `addEventListener` under the hood. This is especially
useful for custom elements that don't implement event handlers via JS properties
like native elements do, f.e. `el.oninput = () => {...}`.

With property-based event handlers such as `.onclick`, setting up an event
handler using `html`, like this,

```js
const [el] = html`<button .onclick=${() => {...}}></button>`
```

is the same as setting it up with the JS property directly:

```js
const el = document.createElement('button')
el.onclick = () => {...}
```

The `.onevent=` syntax is not doing anything special with event handlers, it is
literally just setting a JS property exactly as specified (some elements just so
happen to accept function values for various properties, f.e. event handlers).

With that in mind, the `@event=` syntax is special in that it is not setting a
JS property, but setting up event listeners with `add/removeEventListener()`,
regardless if the element has JS properties that accept event handler functions
(most custom elements in the wild do not have such event handler JS properties).

## SVG and MathML Support

The library provides dedicated `svg` and `mathml` template tag functions that
create elements with proper namespaces in the absence of `<svg>` or `<math>`
root elements:

```javascript
import {html, svg, mathml} from 'nimble-html'

const key = Symbol()
const radius = 25
const color = 'red'
const width = 30
const height = 30

// SVG elements are created with proper SVG namespace (without needing a wrapping <svg>)
const [circle, rect] = svg`
  <circle cx="50" cy="50" r=${radius} fill=${color}/>
  <rect x="10" y="10" width=${width} height=${height} fill="blue"/>
`(key)

console.log(circle instanceof SVGCircleElement) // true
console.log(rect instanceof SVGRectElement) // true

// MathML elements are created with proper MathML namespace (without needing a wrapping <math>)
const numerator = 'a'
const denominator = 'b'
const [mfrac] = mathml`
  <mfrac>
    <mi>${numerator}</mi>
    <mi>${denominator}</mi>
  </mfrac>
`(key)

console.log(mfrac.namespaceURI) // "http://www.w3.org/1998/Math/MathML"
```

## Nested Templates with Mixed Content

Partial `svg` and `mathml` templates (without `<svg>` or `<math>` root elements)
can be nested inside `html` templates to produce properly namespaced mixed
content:

```javascript
const key = Symbol()
const centerX = 50
const centerY = 50
const radius = 40
const fillColor = 'lightblue'
const label = 'Dynamic SVG'
const variable = 'x'
const exponent = 2

const colors = ['deepink', 'gold', 'teal']

const [article] = html`
  <article>
    <h1>Mixed Content Example</h1>

    <section class="graphics">
      <svg width="100" height="100">
        ${colors.map(
          (color, i) =>
            svg`
              <circle cx=${centerX + i * 10} cy=${centerY + i * 10} r=${radius + i} fill=${color}/>
              <text x=${centerX + 5 + i} y=${centerY + 5 + i} text-anchor="middle" fill=${color}>${color}</text>
            `,
        )}
      </svg>
    </section>

    <section class="math">
      <math>
        ${colors.map(
          (color, i) =>
            mathml`
              <mrow style="font-size: 1.5em; color: ${color}; translate: ${i * 40}px ${i * 40}px;">
                <msup>
                  <mi>${color}</mi>
                  <mn>${exponent}</mn>
                </msup>
                <mo>+</mo>
                <mn>1</mn>
                <mo>=</mo>
                <mn>0</mn>
              </mrow>
            `,
        )}
      </math>
    </section>
  </article>
`(key)

// All elements have correct types and namespaces
const circle = article.querySelector('circle')
console.log(circle instanceof SVGCircleElement) // true

const mrow = article.querySelector('mrow')
console.log(mrow.namespaceURI) // "http://www.w3.org/1998/Math/MathML"
```

# Making Higher-level Frameworks

It's really simple with this nimble `html` tag!

## Tiny Custom Element "Framework" Example

This example is so small, it's not really a framework, but it shows how
straightforward it is to build custom elements with declarative-reactive `html`
templates:

```javascript
class MyElement extends HTMLElement {
  #value = 123

  get value() {
    return this.#value
  }
  set value(val) {
    this.#value = val
    // Re-running the template with same key updates existing DOM. How easy!
    this.template()
  }

  template() {
    return html` <div>Current value: ${this.value}</div> `(this) // Use 'this' as the key
  }

  constructor() {
    super()
    this.attachShadow({mode: 'open'})
    this.shadowRoot.append(...this.template())
  }
}

customElements.define('my-element', MyElement)

const key = Symbol()
const app = value => html`<my-element .value=${value}></my-element>`(key)

document.body.append(...app(123))

// Renders "Current value: 123"

app(456)

// Renders "Current value: 456"
```

# API Reference

## Template Tag Functions

### `html(strings, ...values)(key)`

Creates HTML elements with the HTML namespace. This is the main template function for regular HTML content.

### `svg(strings, ...values)(key)`

Creates SVG elements with the SVG namespace (`http://www.w3.org/2000/svg`). Use this for creating SVG content that needs to be properly recognized as SVG elements.

### `mathml(strings, ...values)(key)`

Creates MathML elements with the MathML namespace (`http://www.w3.org/1998/Math/MathML`). Use this for creating mathematical notation that renders properly in browsers.

```js
const htmlTemplate = html`<div>${value}</div>`
const svgTemplate = svg`<circle cx="50" cy="50" r="25"/>`
const mathTemplate = mathml`<mfrac><mi>a</mi><mi>b</mi></mfrac>`
```

**Parameters (all functions):**

- `strings`: TemplateStringsArray - The template literal strings
- `values`: Array of interpolation values
- `key`: Any unique value used to identify the DOM instance

**Returns:**

- Array of the template's top-level Nodes with proper namespace and element types.

**Supported Interpolations (all functions):**

- Text content: `${value}`
- Attributes: `attr=${value}` or `attr="${value}"`
- Boolean attributes: `?attr=${boolean}`
- Properties: `.prop=${value}` _(case-sensitive)_
- Events: `@event=${handler}` _(case-sensitive)_

# Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT
