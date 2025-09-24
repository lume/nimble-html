# HTML Template Tag

A framework-agnostic `html` template tag function for writing declarative-reactive HTML/DOM, a starting point for frameworks to build with.

## Features

- **Framework-agnostic**: Works with any JavaScript framework or no framework at all
- **Template caching**: Templates are cached based on source location for optimal performance
- **Instance management**: Unique keys create a unique DOM instances that can be updated in place
- **Attribute and property binding**: Supports regular attributes, boolean attributes, JS properties, and event handlers
- **Type-safe**: Written in plain JavaScript with JSDoc types for TypeScript compatibility
- **Zero dependencies**: Lightweight implementation using only DOM APIs
- **Lit-compatible syntax**: Uses familiar `html` template syntax for easy adoption

## Installation

Clone this repository, or copy html.js to your project, or import it directly
from GitHub into your JS code (using the raw.githack.com proxy):

```html
<script type="module">
  import {html} from 'https://cdn.githack.com/lume/html/main/html.js'

  const feeling = 'wonderfulness'
  const div = html`<div>${feeling}</div>`()

  document.body.append(div)
</script>
```

## Basic Usage

```javascript
import {html} from './html.js'

// Basic text interpolation
const value = 'Hello World'
const key = Symbol() // or any unique value

const div = html`<div>Message: ${value}</div>`(key)
console.log(div instanceof HTMLDivElement) // true
console.log(div.textContent) // "Message: Hello World"
```

## Key Concepts

### Template Identity and Keying

Templates are identified by two things:

1. **Source location** - The unique template strings array from your source code
2. **Key** - A unique identifier you provide when calling the template

This allows for efficient caching and DOM reuse:

```javascript
const key = Symbol()

function render(value) {
  return html`<div>Value: ${value}</div>`(key)
}

const div1 = render('first')
const div2 = render('second')

console.log(div1 === div2) // true - same DOM instance!
console.log(div2.textContent) // "Value: second" - content updated

document.body.append(div1, div2)
```

### Attribute Types

The library supports different attribute binding syntaxes:

```javascript
const value = 'dynamic'
const isEnabled = true
const clickHandler = () => console.log('clicked')

const element = html`
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

### Multiple Elements

When your template has multiple root elements, the function returns an array:

```javascript
const elements = html`
  <div>First element</div>
  <div>Second element</div>
`(key)

console.log(Array.isArray(elements)) // true
console.log(elements.length) // 2
```

## Custom Elements Integration

The library works great with custom elements:

```javascript
class MyElement extends HTMLElement {
  #value = 123

  get value() {
    return this.#value
  }
  set value(val) {
    this.#value = val
    // Re-running the template with same key updates existing DOM
    this.template()
  }

  template() {
    return html` <div>Current value: ${this.value}</div> `(this) // Use 'this' as the key
  }

  connectedCallback() {
    const content = this.template()
    this.appendChild(content)
  }
}

customElements.define('my-element', MyElement)

const el = new MyElement()
document.body.append(el)

// Renders "Current value: 123"

el.value = 456

// Renders "Current value: 456"
```

## Advanced Usage

### Creating Multiple Instances

You can create multiple instances of the same template by using different keys:

```javascript
function createCard(title, key) {
  return html`
    <div class="card">
      <h2>${title}</h2>
    </div>
  `(key)
}

const card1 = createCard('First Card', Symbol())
const card2 = createCard('Second Card', Symbol())

// card1 and card2 are different DOM instances
console.log(card1 !== card2) // true
```

### Event Handlers

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

## API Reference

### `html(strings, ...values)(key)`

The `html` template tag function.

**Parameters:**

- `strings`: TemplateStringsArray - The template literal strings
- `values`: Array of interpolation values
- `key`: Any unique value used to identify the DOM instance

**Returns:**

- Single DOM Node if template has one root element
- Array of DOM Nodes if template has multiple root elements

**Supported Interpolations:**

- Text content: `${value}`
- Attributes: `attr=${value}` or `attr="${value}"`
- Boolean attributes: `?attr=${boolean}`
- Properties: `.prop=${value}`
- Events: `@event=${handler}`

## Development

This project uses:

- Plain JavaScript (ES2022) with JSDoc types
- TypeScript for type checking only
- @web/test-runner for browser-based testing

```bash
# Type check
npm run typecheck

# Run tests (includes type checking)
npm test

# Watch tests
npm run test:watch
```

## License

MIT
