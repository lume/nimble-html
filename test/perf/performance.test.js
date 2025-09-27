/**
 * Performance tests for the html template tag function.
 *
 * These tests measure the performance of various template operations and ensure
 * they stay within reasonable bounds. The thresholds are based on actual measurements
 * with safety margins to account for different environments and occasional slowdowns.
 *
 * Each test logs its results so you can see the actual performance characteristics
 * and adjust thresholds if needed for different environments.
 */
import {html} from '../../html.js'

// This import of solid-js currently doesn't work with web-test-runner. https://github.com/modernweb-dev/web/issues/2985
// import {createSignal, For, batch} from 'solid-js'
// import solidHtml from 'solid-js/html'
// import {render} from 'solid-js/web'

// So instead we use dynamic import with eval to avoid WTR's default code
// transform from messing with the imports.
const {createSignal, For, batch} = /** @type {typeof import("solid-js")} */ (await eval('import("solid-js")'))
const {default: solidHtml} = /** @type {typeof import("solid-js/html")} */ (await eval('import("solid-js/html")'))
const {render} = /** @type {typeof import("solid-js/web")} */ (await eval('import("solid-js/web")'))
export {} // Tell TS this is a module so that top-level await ^ statements show no type error.

/**
 * @param {any} condition
 * @param {string} message
 */
function assertTrue(condition, message = '') {
	if (!condition) throw new Error(`Assertion failed: ${message}\nExpected truthy value`)
}

/**
 * Performance test helper that runs a test function multiple times and measures execution time
 * @param {string} testName
 * @param {() => void} testFn
 * @param {number} iterations
 * @param {number} maxTimeMs - Maximum allowed time in milliseconds
 */
function performanceTest(testName, testFn, iterations = 1000, maxTimeMs = 100) {
	const startTime = performance.now()

	for (let i = 0; i < iterations; i++) {
		testFn()
	}

	const endTime = performance.now()
	const totalTime = endTime - startTime
	const avgTime = totalTime / iterations

	console.log(`${testName}: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg (${iterations} iterations)`)

	// Assert that total time doesn't exceed the maximum
	assertTrue(totalTime <= maxTimeMs, `${testName} took ${totalTime.toFixed(2)}ms, expected ≤ ${maxTimeMs}ms`)
}

describe('html template update performance', () => {
	beforeEach(() => {
		// Clean up DOM before each test
		document.body.innerHTML = ''
	})

	it('single value updates - text interpolation', () => {
		const key = Symbol()
		let counter = 0
		const template = () => html`<div>Count: ${counter}</div>`(key)
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Single value text updates',
			() => {
				counter++
				template()
			},
			1000,
			10, // Based on measured ~2.2ms, allow 10ms with safety margin
		)

		div.remove()
	})

	it('single value updates - text interpolation (Solid)', () => {
		const [counter, setCounter] = createSignal(0)
		let container = document.createElement('div')

		// Setup: render template once
		render(() => solidHtml`<div>Count: ${counter}</div>`, container)
		document.body.append(container)

		performanceTest(
			'Single value text updates (Solid)',
			() => {
				setCounter(c => c + 1) // Signal update triggers reactive template update
			},
			1000,
			10,
		)

		// Cleanup
		container.remove()
	})

	it('multiple value updates - multiple interpolations', () => {
		const key = Symbol()
		let counter1 = 0
		let counter2 = 0
		let counter3 = 0
		const template = () => html`<div>A: ${counter1}, B: ${counter2}, C: ${counter3}</div>`(key)
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Multiple value updates',
			() => {
				counter1++
				counter2 += 2
				counter3 += 3
				template()
			},
			1000,
			12, // Based on measured ~2.4ms, allow 12ms
		)

		div.remove()
	})

	it('multiple value updates - multiple interpolations (Solid)', () => {
		const [counter1, setCounter1] = createSignal(0)
		const [counter2, setCounter2] = createSignal(0)
		const [counter3, setCounter3] = createSignal(0)
		let container = document.createElement('div')

		// Setup: render template once
		render(() => solidHtml`<div>A: ${counter1}, B: ${counter2}, C: ${counter3}</div>`, container)
		document.body.append(container)
		const div = container.firstChild

		performanceTest(
			'Multiple value updates (Solid)',
			() => {
				batch(() => {
					setCounter1(c => c + 1)
					setCounter2(c => c + 2)
					setCounter3(c => c + 3)
				})
				assertTrue(div?.textContent === `A: ${counter1()}, B: ${counter2()}, C: ${counter3()}`) // Ensure update applied
			},
			1000,
			12,
		)

		// Cleanup
		container.remove()
	})

	it('attribute updates', () => {
		const key = Symbol()
		let classValue = 'initial'
		const template = () => html`<div class=${classValue}>Content</div>`(key)
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Attribute updates',
			() => {
				classValue = classValue === 'initial' ? 'updated' : 'initial'
				template()
			},
			800,
			10,
		)

		div.remove()
	})

	it('attribute updates (Solid)', () => {
		const [classValue, setClassValue] = createSignal('initial')
		let container = document.createElement('div')

		// Setup: render template once
		render(() => solidHtml`<div class=${classValue}>Content</div>`, container)
		document.body.append(container)

		performanceTest(
			'Attribute updates (Solid)',
			() => {
				setClassValue(c => (c === 'initial' ? 'updated' : 'initial'))
			},
			800,
			10,
		)

		// Cleanup
		container.remove()
	})

	it('boolean attribute updates', () => {
		const key = Symbol()
		let isChecked = false
		const template = () => html`<input type="checkbox" checked=${isChecked} />`(key)
		const [input] = template()
		document.body.append(input)

		performanceTest(
			'Boolean attribute updates',
			() => {
				isChecked = !isChecked
				template()
			},
			800,
			10,
		)

		input.remove()
	})

	it('boolean attribute updates (Solid)', () => {
		const [isChecked, setIsChecked] = createSignal(false)
		let container = document.createElement('div')

		// Setup: render template once
		render(() => solidHtml`<input type="checkbox" checked=${isChecked} />`, container)
		document.body.append(container)

		performanceTest(
			'Boolean attribute updates (Solid)',
			() => {
				setIsChecked(c => !c)
			},
			800,
			10,
		)

		// Cleanup
		container.remove()
	})

	it('event handler updates', () => {
		const key = Symbol()
		let clickCount = 0
		const template = () => {
			const handler = () => clickCount++
			return html`<button @click=${handler}>Click me</button>`(key)
		}
		const [button] = template()
		document.body.append(button)

		performanceTest(
			'Event handler updates',
			() => {
				template()
			},
			800,
			10,
		)

		button.remove()
	})

	it('event handler updates (Solid)', () => {
		const [, setClickCount] = createSignal(0)
		const [handler, setHandler] = createSignal(() => setClickCount(c => c + 1))
		let container = document.createElement('div')

		// Setup: render template once
		render(() => solidHtml`<button onclick=${() => handler()}>Click me</button>`, container)
		document.body.append(container)

		performanceTest(
			'Event handler updates (Solid)',
			() => {
				setHandler(() => () => setClickCount(c => c + 1))
			},
			800,
			10,
		)

		// Cleanup
		container.remove()
	})

	it('conditional rendering - toggling branches', () => {
		const key = Symbol()
		let showFirst = true
		const template = () => html`<div>${showFirst ? 'First branch' : 'Second branch'}</div>`(key)
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Conditional rendering',
			() => {
				showFirst = !showFirst
				template()
			},
			800,
			10,
		)

		div.remove()
	})

	it('conditional rendering - toggling branches (Solid)', () => {
		const [showFirst, setShowFirst] = createSignal(true)
		let container = document.createElement('div')

		// Setup: render template once
		render(() => solidHtml`<div>${() => (showFirst() ? 'First branch' : 'Second branch')}</div>`, container)
		document.body.append(container)

		performanceTest(
			'Conditional rendering (Solid)',
			() => {
				setShowFirst(s => !s)
			},
			800,
			10,
		)

		// Cleanup
		container.remove()
	})

	it('nested template functions - without explicit keys', () => {
		const key = Symbol()
		let items = ['apple', 'banana', 'cherry']
		let counter = 0
		const template = () => {
			const itemTemplates = items.map(item => html`<li>${item}</li>`)
			return html`<ul>
				${itemTemplates}
			</ul>`(key)
		}
		const [ul] = template()
		document.body.append(ul)

		performanceTest(
			'Nested template functions (no keys)',
			() => {
				counter++
				// Rotate items and add counter to simulate data changes
				items = [...items.slice(1), items[0] + counter]
				template()
			},
			500,
			10, // Based on measured ~2.1ms, allow 10ms
		)

		ul.remove()
	})

	it('nested template functions - without explicit keys (Solid)', () => {
		let initialItems = ['apple', 'banana', 'cherry']
		const [items, setItems] = createSignal(initialItems)
		let counter = 0
		let container = document.createElement('div')

		// Setup: render template once using For component
		render(
			() =>
				For({
					get each() {
						return items()
					},
					children: item => solidHtml`<li>${item}</li>`,
				}),
			container,
		)
		document.body.append(container)

		performanceTest(
			'Nested template functions (no keys) (Solid)',
			() => {
				counter++
				// Rotate items and add counter to simulate data changes
				const currentItems = items()
				setItems([...currentItems.slice(1), currentItems[0] + counter])
			},
			500,
			10,
		)

		// Cleanup
		container.remove()
	})

	it('nested template functions - with explicit keys', () => {
		const key = Symbol()
		let items = ['apple', 'banana', 'cherry']
		let counter = 0
		const template = () => {
			const itemTemplates = items.map((item, index) => html`<li>${item}</li>`(Symbol(`item-${index}`)))
			return html`<ul>
				${itemTemplates}
			</ul>`(key)
		}
		const [ul] = template()
		document.body.append(ul)

		performanceTest(
			'Nested template functions (with keys)',
			() => {
				counter++
				// Rotate items and add counter to simulate data changes
				items = [...items.slice(1), items[0] + counter]
				template()
			},
			500,
			25, // Based on measured ~6.3ms, allow 25ms
		)

		ul.remove()
	})

	it('nested template functions - with explicit keys (Solid)', () => {
		let initialItems = ['apple', 'banana', 'cherry']
		const [items, setItems] = createSignal(initialItems)
		let counter = 0
		let container = document.createElement('div')

		// Setup: render template once using For component with fallback key
		render(
			() =>
				For({
					get each() {
						return items()
					},
					fallback: null,
					children: item => solidHtml`<li>${item}</li>`,
				}),
			container,
		)
		document.body.append(container)

		performanceTest(
			'Nested template functions (with keys) (Solid)',
			() => {
				counter++
				// Rotate items and add counter to simulate data changes
				const currentItems = items()
				setItems([...currentItems.slice(1), currentItems[0] + counter])
			},
			500,
			25,
		)

		// Cleanup
		container.remove()
	})

	it('list updates - items.map pattern', () => {
		const key = Symbol()
		let items = Array.from({length: 10}, (_, i) => `Item ${i}`)
		const template = () =>
			html`<ul>
				${items.map(item => html`<li>${item}</li>`)}
			</ul>`(key)
		const [ul] = template()
		document.body.append(ul)

		performanceTest(
			'List updates (items.map)',
			() => {
				// Simulate typical list updates
				items = items.map(item => item + '!')
				template()
			},
			300,
			20, // Based on measured ~4.2ms, allow 20ms
		)

		ul.remove()
	})

	it('list updates - items.map pattern (Solid)', () => {
		let initialItems = Array.from({length: 10}, (_, i) => `Item ${i}`)
		const [items, setItems] = createSignal(initialItems)
		let container = document.createElement('div')

		// Setup: render template once using For component
		render(
			() =>
				solidHtml`<ul>${For({
					get each() {
						return items()
					},
					children: item => solidHtml`<li>${item}</li>`,
				})}</ul>`,
			container,
		)
		document.body.append(container)

		performanceTest(
			'List updates (items.map) (Solid)',
			() => {
				// Simulate typical list updates
				setItems(current => current.map(item => item + '!'))
			},
			300,
			20,
		)

		// Cleanup
		container.remove()
	})

	it('dynamic list updates - adding/removing items', () => {
		const key = Symbol()
		let items = ['Item 0', 'Item 1', 'Item 2']
		let counter = 3
		const template = () =>
			html`<ul>
				${items.map(item => html`<li>${item}</li>`)}
			</ul>`(key)
		const [ul] = template()
		document.body.append(ul)

		performanceTest(
			'Dynamic list updates (add/remove)',
			() => {
				// Randomly add or remove items
				if (Math.random() > 0.5 && items.length < 20) {
					items.push(`Item ${counter++}`)
				} else if (items.length > 1) {
					items.splice(Math.floor(Math.random() * items.length), 1)
				}

				template()
			},
			300,
			8, // Based on measured ~1.4ms, allow 8ms
		)

		ul.remove()
	})

	it('dynamic list updates - adding/removing items (Solid)', () => {
		let initialItems = ['Item 0', 'Item 1', 'Item 2']
		const [items, setItems] = createSignal(initialItems)
		let counter = 3
		let container = document.createElement('div')

		// Setup: render template once using For component
		render(
			() =>
				solidHtml`<ul>${For({
					get each() {
						return items()
					},
					children: item => solidHtml`<li>${item}</li>`,
				})}</ul>`,
			container,
		)
		document.body.append(container)

		performanceTest(
			'Dynamic list updates (add/remove) (Solid)',
			() => {
				setItems(current => {
					const newItems = [...current]
					// Randomly add or remove items
					if (Math.random() > 0.5 && newItems.length < 20) {
						newItems.push(`Item ${counter++}`)
					} else if (newItems.length > 1) {
						newItems.splice(Math.floor(Math.random() * newItems.length), 1)
					}
					return newItems
				})
			},
			300,
			8,
		)

		// Cleanup
		container.remove()
	})

	it('complex nested structures', () => {
		const key = Symbol()
		let users = [
			{id: 1, name: 'Alice', posts: ['Post 1', 'Post 2']},
			{id: 2, name: 'Bob', posts: ['Post A']},
			{id: 3, name: 'Charlie', posts: ['Post X', 'Post Y', 'Post Z']},
		]
		let counter = 0
		const template = () =>
			html`<div class="users">
				${users.map(
					user => html`
						<div class="user">
							<h3>${user.name}</h3>
							<ul class="posts">
								${user.posts.map(post => html`<li>${post}</li>`)}
							</ul>
						</div>
					`,
				)}
			</div>`(key)
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Complex nested structures',
			() => {
				counter++
				// Update user data
				users = users.map(user => ({
					...user,
					name: user.name + counter,
					posts: user.posts.map(post => post + '!'),
				}))

				template()
			},
			200,
			30, // Based on measured ~6.2ms, allow 30ms
		)

		div.remove()
	})

	it('template reuse - same template, different keys', () => {
		let counter = 0
		const createInstances = () => {
			const template = html`<div>Counter: ${counter}</div>`
			return [template(Symbol('key1')), template(Symbol('key2')), template(Symbol('key3'))]
		}
		const instances = createInstances()
		instances.forEach(([div]) => document.body.append(div))

		performanceTest(
			'Template reuse with different keys',
			() => {
				counter++
				// Create multiple instances of the same template with different keys
				createInstances()
			},
			500,
			25, // Based on measured ~6.0ms, allow 25ms
		)

		instances.forEach(([div]) => div.remove())
	})

	it('deep nesting performance', () => {
		const key = Symbol()
		let depth = 0
		const template = () => {
			let innerTemplate = html`<span>Depth ${depth}</span>`(Symbol())
			for (let i = 0; i < depth; i++) {
				innerTemplate = html`<div class="level-${i}">${innerTemplate}</div>`(Symbol())
			}
			return html`<div class="root">${innerTemplate}</div>`(key)
		}
		depth = 1
		const [root] = template()
		document.body.append(root)

		performanceTest(
			'Deep nesting',
			() => {
				depth = ((depth + 1) % 10) + 1 // Cycle between 1-10 levels deep
				template()
			},
			300,
			45, // Based on measured ~11.0ms, allow 45ms
		)

		root.remove()
	})

	it('mixed content types', () => {
		const key = Symbol()
		let counter = 0
		const template = () => {
			const mixedContent = [
				`Text content ${counter}`,
				html`<span>Template ${counter}</span>`(Symbol()),
				counter,
				counter > 50 ? html`<div>Conditional</div>`(Symbol()) : null,
				[html`<p>Array item 1</p>`(Symbol()), html`<p>Array item 2</p>`(Symbol())],
			]
			return html`<div class="mixed">${mixedContent}</div>`(key)
		}
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Mixed content types',
			() => {
				counter++
				template()
			},
			400,
			55, // Based on measured ~13.7ms, allow 55ms
		)

		div.remove()
	})

	it('attribute vs text performance comparison', () => {
		const key1 = Symbol()
		const key2 = Symbol()
		let counter = 0

		// Setup attribute template
		const attrTemplate = () => html`<div class="item-${counter}" data-count="${counter}">Static</div>`(key1)
		const [attrDiv] = attrTemplate()
		document.body.append(attrDiv)

		// Test attribute updates
		const startAttr = performance.now()
		for (let i = 0; i < 500; i++) {
			counter++
			attrTemplate()
		}
		const attrTime = performance.now() - startAttr

		// Reset counter for fair comparison
		counter = 0

		// Setup text template
		const textTemplate = () => html`<div>Count: ${counter}, Value: ${counter * 2}</div>`(key2)
		const [textDiv] = textTemplate()
		document.body.append(textDiv)

		// Test text updates
		const startText = performance.now()
		for (let i = 0; i < 500; i++) {
			counter++
			textTemplate()
		}
		const textTime = performance.now() - startText

		console.log(`Attribute updates: ${attrTime.toFixed(2)}ms`)
		console.log(`Text updates: ${textTime.toFixed(2)}ms`)
		console.log(`Ratio (attr/text): ${(attrTime / textTime).toFixed(2)}`)

		// Both should be reasonably fast based on measurements
		assertTrue(attrTime < 6, `Attribute updates took ${attrTime.toFixed(2)}ms, expected < 6ms`)
		assertTrue(textTime < 4, `Text updates took ${textTime.toFixed(2)}ms, expected < 4ms`)

		// Cleanup
		attrDiv.remove()
		textDiv.remove()
	})

	it('cache efficiency - repeated renders with same data', () => {
		const key = Symbol()
		const staticData = {
			title: 'Static Title',
			items: ['Item 1', 'Item 2', 'Item 3'],
			count: 42,
		}
		const template = () =>
			html`<div>
				<h1>${staticData.title}</h1>
				<p>Count: ${staticData.count}</p>
				<ul>
					${staticData.items.map(item => html`<li>${item}</li>`)}
				</ul>
			</div>`(key)
		const [div] = template()
		document.body.append(div)

		performanceTest(
			'Cache efficiency (same data)',
			() => {
				// Render the same data repeatedly - should be fast due to caching
				template()
			},
			1000,
			15, // Based on measured ~2.8ms, allow 15ms (should be fast due to caching)
		)

		div.remove()
	})
})
