import {html, force} from '../html.js'

/**
 * @param {any} actual
 * @param {any} expected
 * @param {string} message
 */
function assertEquals(actual, expected, message = '') {
	if (actual !== expected)
		throw new Error(`Assertion failed: ${message}\nExpected: >>>${expected}<<<\nActual: >>>${actual}<<<`)
}

/**
 * @param {any} condition
 * @param {string} message
 */
function assertTrue(condition, message = '') {
	if (!condition) throw new Error(`Assertion failed: ${message}\nExpected truthy value`)
}

/**
 * @param {() => void} fn
 * @param {RegExp} expectedErrorPattern
 * @param {string} message
 */
function assertThrows(fn, expectedErrorPattern, message = '') {
	try {
		fn()
		throw new Error(`Assertion failed: ${message}\nExpected function to throw`)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		if (expectedErrorPattern && !expectedErrorPattern.test(errorMessage)) {
			throw new Error(
				`Assertion failed: ${message}\nExpected error matching: ${expectedErrorPattern}\nActual error: ${errorMessage}`,
			)
		}
	}
}

let setCount = 0

class ForceElement extends HTMLElement {
	_testProp = ''

	set testProp(val) {
		this._testProp = val
		setCount++
	}
	get testProp() {
		return this._testProp
	}
}

customElements.define('force-element', ForceElement)

describe('force functionality', () => {
	it('should skip equality checks with force() wrapper', () => {
		let callCount = 0
		setCount = 0
		const value = 'test'

		const template = () => {
			callCount++
			return html`<force-element .testProp=${force(value)}></force-element>`
		}

		// First render
		const key = Symbol()
		const nodes1 = template()(key)
		const element = /** @type {any} */ (nodes1[0])
		assertEquals(element.testProp, 'test')
		assertEquals(callCount, 1)
		assertEquals(setCount, 1)

		// Second render with same value - should still update due to force
		const nodes2 = template()(key)
		assertEquals(nodes2[0], element) // Same element instance
		assertEquals(element.testProp, 'test')
		assertEquals(callCount, 2)
		assertEquals(setCount, 2)
	})

	it('should skip equality checks with ! syntax', () => {
		let callCount = 0
		setCount = 0
		const value = 'test'

		const template = () => {
			callCount++
			return html`<force-element !.testProp=${value}></force-element>`
		}

		// First render
		const key = Symbol()
		const nodes1 = template()(key)
		const element = /** @type {any} */ (nodes1[0])
		assertEquals(element.testProp, 'test')
		assertEquals(callCount, 1)
		assertEquals(setCount, 1)

		// Second render with same value - should still update due to !
		const nodes2 = template()(key)
		assertEquals(nodes2[0], element) // Same element instance
		assertEquals(element.testProp, 'test')
		assertEquals(callCount, 2)
		assertEquals(setCount, 2)
	})

	it('should work with combined ! and force syntax', () => {
		setCount = 0
		const template = () => html`<force-element !.testProp=${force('combined')}></force-element>`

		const key = Symbol()
		const nodes = template()(key)
		const element = /** @type {any} */ (nodes[0])
		assertEquals(element.testProp, 'combined')
		assertEquals(setCount, 1)

		// Second render with same value - should still update
		const nodes2 = template()(key)
		assertEquals(nodes2[0], element) // Same element instance
		assertEquals(element.testProp, 'combined')
		assertEquals(setCount, 2)
	})

	it('should throw error when force usage becomes inconsistent', () => {
		let useForce = true
		const value = 'test'

		const template = () => html`<force-element .testProp=${useForce ? force(value) : value}></force-element>`

		// First render with force
		const key = Symbol()
		template()(key)

		// Second render without force should throw
		useForce = false
		assertThrows(() => {
			template()(key)
		}, /Value must be wrapped with force/)
	})

	it('should work with text interpolation', async () => {
		const template = () => html`<div>${force('text')}</div>`

		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		assertEquals(nodes1[0].textContent, 'text')

		let called = false

		// Use MutationObserver to verify text is updated again
		const observer = new MutationObserver(mutations => {
			called = true
			// Text content changes trigger characterData mutations on text nodes
			assertTrue(mutations.length >= 1)
			const textMutation = mutations.find(m => m.type === 'characterData')
			assertTrue(!!textMutation, 'Should have a characterData mutation')
		})
		observer.observe(nodes1[0], {childList: true, subtree: true, characterData: true})

		// Should update even with same value
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver
		assertEquals(nodes2[0], nodes1[0]) // Same element instance
		assertEquals(nodes2[0].textContent, 'text')
		assertTrue(called, 'MutationObserver callback was called')

		observer.disconnect()
		nodes1[0].remove()
	})

	it('should work with boolean attributes', async () => {
		const template = () => html`<div !?hidden=${true}></div>`

		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		const element = /** @type {Element} */ (nodes1[0])
		assertTrue(element.hasAttribute('hidden'))

		let mutationCalled = false

		// Use MutationObserver to verify attribute is set again even with same value
		const observer = new MutationObserver(mutations => {
			mutationCalled = true
			assertTrue(
				mutations.length === 1 && mutations[0].type === 'attributes' && mutations[0].attributeName === 'hidden',
				'Should have a hidden attribute mutation',
			)
		})
		observer.observe(element, {attributes: true})

		// Second render with same value - should still update due to !
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver
		assertEquals(nodes2[0], element) // Same element instance
		assertTrue(element.hasAttribute('hidden'))
		assertTrue(mutationCalled, 'MutationObserver should detect attribute update')

		observer.disconnect()
		element.remove()
	})

	it('should work with event handlers', async () => {
		let callCount = 0
		let currentHandler = () => callCount++
		const template = () => html`<div !@click=${currentHandler}></div>`

		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		const element = /** @type {HTMLElement} */ (nodes1[0])

		// Test initial event handler
		element.click()
		assertEquals(callCount, 1)

		// Second render with same handler - should still work due to !
		// (Note: The internal optimization means the same stable handler wrapper is reused,
		// but the ! ensures the template processing doesn't skip the event handler update)
		const nodes2 = template()(key)
		assertEquals(nodes2[0], element) // Same element instance

		// Test that the event handler still works after re-render
		element.click()
		assertEquals(callCount, 2)

		// Test with a different handler to verify the ! syntax works with changes too
		let callCount2 = 0
		currentHandler = () => callCount2++

		const nodes3 = template()(key)
		assertEquals(nodes3[0], element) // Same element instance

		// New handler should work, old handler should not
		element.click()
		assertEquals(callCount, 2) // Original counter should not increment
		assertEquals(callCount2, 1) // New counter should increment

		element.remove()
	})

	it('should work with regular attributes', async () => {
		const template = () => html`<div !title=${'tooltip'}></div>`

		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		const element = /** @type {Element} */ (nodes1[0])
		assertEquals(element.getAttribute('title'), 'tooltip')

		let mutationCalled = false

		// Use MutationObserver to verify attribute is set again even with same value
		const observer = new MutationObserver(mutations => {
			mutationCalled = true
			const attrMutation = mutations.find(m => m.type === 'attributes' && m.attributeName === 'title')
			assertTrue(!!attrMutation, 'Should have a title attribute mutation')
		})
		observer.observe(element, {attributes: true})

		// Second render with same value - should still update due to !
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver
		assertEquals(nodes2[0], element) // Same element instance
		assertEquals(element.getAttribute('title'), 'tooltip')
		assertTrue(mutationCalled, 'MutationObserver should detect attribute update')

		observer.disconnect()
		element.remove()
	})

	const template = () => html`
		<div class=${force('same-class')}></div>
		<div class=${'same-class'}></div>
	`

	// This also tests that a static !foo="bar" attribute maps to foo="bar"
	// (sets it only once though)
	const template2 = () => html`
		<div !class="same-class"></div>
		<div class=${'same-class'}></div>
	`

	const template3 = () => html`
		<div !class=${'same-class'}></div>
		<div class=${'same-class'}></div>
	`

	const template4 = () => html`
		<div !?class=${true}></div>
		<div ?class=${true}></div>
	`

	/**
	 * @param {(typeof template)} template
	 */
	async function testForceIsolation(template, isBoolean = false) {
		const key = Symbol()
		const nodes1 = /** @type {Element[]} */ (template()(key))
		document.body.append(...nodes1)
		const element1 = /** @type {Element} */ (nodes1[0])
		const element2 = /** @type {Element} */ (nodes1[1])

		assertEquals(element1.getAttribute('class'), isBoolean ? '' : 'same-class')
		assertEquals(element2.getAttribute('class'), isBoolean ? '' : 'same-class')

		let element1MutationCalled = false
		let element2MutationCalled = false

		// Use separate observers for each element
		const observer1 = new MutationObserver(mutations => {
			element1MutationCalled = true
			const attrMutation = mutations.find(m => m.type === 'attributes' && m.attributeName === 'class')
			assertTrue(!!attrMutation, 'Element 1 should have a class attribute mutation')
		})
		observer1.observe(element1, {attributes: true})

		const observer2 = new MutationObserver(() => (element2MutationCalled = true))
		observer2.observe(element2, {attributes: true})

		// Second render with same values
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver

		assertEquals(nodes2[0], element1) // Same element instances
		assertEquals(nodes2[1], element2)
		assertEquals(element1.getAttribute('class'), isBoolean ? '' : 'same-class')
		assertEquals(element2.getAttribute('class'), isBoolean ? '' : 'same-class')

		// Element 1 should update due to force(), element 2 should not
		assertTrue(element1MutationCalled, 'Element 1 with force should detect mutation')
		assertEquals(element2MutationCalled, false, 'Element 2 without force should NOT detect mutation')

		observer1.disconnect()
		observer2.disconnect()
		element1.remove()
		element2.remove()
	}

	it('should NOT affect other elements with same attribute in same template (force())', async () => {
		await testForceIsolation(template)
	})

	it('should NOT affect other elements with same attribute in same template (regular static attribute)', async () => {
		await testForceIsolation(template2)
	})

	it('should NOT affect other elements with same attribute in same template (!, regular attribute)', async () => {
		await testForceIsolation(template3)
	})

	it('should NOT affect other elements with same attribute in same template (!, boolean attribute)', async () => {
		await testForceIsolation(template4, true)
	})

	// Tests to ensure normal behavior (no updates on same values) when not using ! or force()
	it('should NOT update properties with same values when not using ! or force()', () => {
		setCount = 0
		const value = 'same-value'

		const template = () => html`<force-element .testProp=${value}></force-element>`

		// First render
		const key = Symbol()
		const nodes1 = template()(key)
		const element = /** @type {any} */ (nodes1[0])
		assertEquals(element.testProp, 'same-value')
		assertEquals(setCount, 1)

		// Second render with same value - should NOT trigger setter again
		const nodes2 = template()(key)
		assertEquals(nodes2[0], element) // Same element instance
		assertEquals(element.testProp, 'same-value')
		assertEquals(setCount, 1) // Should still be 1, not 2
	})

	it('should NOT update text content with same values when not using ! or force()', async () => {
		const template = () => html`<div>${'static-text'}</div>`

		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		assertEquals(nodes1[0].textContent, 'static-text')

		let mutationObserved = false

		// Use MutationObserver to verify NO text update happens
		const observer = new MutationObserver(() => {
			mutationObserved = true
		})
		observer.observe(nodes1[0], {childList: true, subtree: true, characterData: true})

		// Should NOT update with same value
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver
		assertEquals(nodes2[0], nodes1[0]) // Same element instance
		assertEquals(nodes2[0].textContent, 'static-text')
		assertEquals(mutationObserved, false, 'No mutation should have been observed')

		observer.disconnect()
		nodes1[0].remove()
	})

	it('should NOT update boolean attributes with same values when not using ! or force()', async () => {
		const template = () => {
			return html`<div ?hidden=${true}></div>`
		}

		// First render
		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		const element = /** @type {Element} */ (nodes1[0])
		assertTrue(element.hasAttribute('hidden'))

		let mutationObserved = false

		// Use MutationObserver to verify NO attribute update happens
		const observer = new MutationObserver(() => {
			mutationObserved = true
		})
		observer.observe(element, {attributes: true})

		// Second render with same value - should NOT cause DOM update
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver
		assertEquals(nodes2[0], element) // Same element instance
		assertTrue(element.hasAttribute('hidden'))
		assertEquals(mutationObserved, false, 'No mutation should have been observed')

		observer.disconnect()
		element.remove()
	})

	it('should NOT update regular attributes with same values when not using ! or force()', async () => {
		const template = () => html`<div title=${'same-tooltip'}></div>`

		// First render
		const key = Symbol()
		const nodes1 = template()(key)
		document.body.append(nodes1[0])
		const element = /** @type {Element} */ (nodes1[0])
		assertEquals(element.getAttribute('title'), 'same-tooltip')

		let mutationObserved = false

		// Use MutationObserver to verify NO attribute update happens
		const observer = new MutationObserver(() => {
			mutationObserved = true
		})
		observer.observe(element, {attributes: true})

		// Second render with same value - should NOT cause DOM update
		const nodes2 = template()(key)
		await Promise.resolve() // Wait for MutationObserver
		assertEquals(nodes2[0], element) // Same element instance
		assertEquals(element.getAttribute('title'), 'same-tooltip')
		assertEquals(mutationObserved, false, 'No mutation should have been observed')

		observer.disconnect()
		element.remove()
	})
})
