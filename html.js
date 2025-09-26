/**
 * Framework-agnostic `html` template tag function.
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {(key: any) => TemplateNodes} A function that accepts a key for
 * template instance identity, and returns DOM nodes rendered with the given
 * values.
 */
export function html(strings, ...values) {
	const template = parseTemplate(strings)
	const templateId = strings

	// Get or create template entry in instance cache
	let templateEntry = instanceCache.get(templateId)
	if (!templateEntry) instanceCache.set(templateId, (templateEntry = {template, instances: new Map()}))

	return function (/** @type {unknown} */ key) {
		let nodes
		let sites

		// Check if we already have an instance for this key
		const templateInstance = templateEntry.instances.get(key)
		if (templateInstance) {
			nodes = templateInstance.nodes
			sites = templateInstance.sites
		} else {
			// Create a new template instance.
			// We're using importNode instead of cloneNode to ensure that custom
			// elements are properly upgraded immediately when cloned, to avoid
			// users facing issues with un-upgraded elements in templates prior
			// to users connecting the elements to the DOM (issues like a
			// template .prop= expression setting a property before the element
			// is upgraded, shadowing getters/setters and breaking reactivity,
			// causing confusion and frustration).
			const fragment = document.importNode(template.content, true) // deep clone

			sites = findInterpolationSites(fragment, templateId)
			nodes = /** @type {TemplateNodes} */ (Object.freeze(Array.from(fragment.childNodes)))

			// Store both nodes and sites for future updates
			templateEntry.instances.set(key, {nodes, sites})
		}

		// Update instance with new values
		applyValues(sites, values, key)

		return nodes
	}
}

/**
 * Template cache based on template strings (source location)
 * @type {WeakMap<TemplateStringsArray, HTMLTemplateElement>}
 */
const templateCache = new WeakMap()

/**
 * Instance cache based on template + key
 * @type {Map<TemplateStringsArray, TemplateEntry>}
 */
const instanceCache = new Map()

/** Unique marker for interpolation sites */
const INTERPOLATION_MARKER = '⧙⧘'

/** RegExp for matching interpolation markers */
const INTERPOLATION_REGEXP = new RegExp(`${INTERPOLATION_MARKER}(\\d+)${INTERPOLATION_MARKER}`)

/** This regex matches . followed by a JS identifier. TODO improve to match actual JS identifiers. */
const JS_PROP_REGEXP = /\.([A-Za-z][A-Za-z0-9]*)/g

/**
 * Map to store original case for property names
 * @type {Map<TemplateStringsArray, Map<string, string>>}
 */
const caseMap = new Map()

/**
 * Parse parts array, converting alternating indices to numbers
 * @param {string[]} parts
 * @param {boolean} isTopLevel - Whether this text node is at the top level of the template
 * @returns {(string|number)[]}
 */
function parseInterpolationParts(parts, isTopLevel = false) {
	let mapped = parts.map((part, i) => (i % 2 === 1 ? parseInt(part) : part))

	// For top-level text nodes, filter out whitespace-only string parts
	// For text nodes inside elements, preserve all parts including whitespace
	if (isTopLevel) mapped = mapped.filter(part => typeof part === 'number' || part.trim() !== '')

	return mapped
}

/**
 * Join parts with value substitution
 * @param {(string|number)[]} parts
 * @param {InterpolationValue[]} values
 * @returns {string}
 */
function joinPartsWithValues(parts, values) {
	return parts
		.map((/** @type {string|number} */ part) => (typeof part === 'number' ? String(values[part] ?? '') : part))
		.join('')
}

/**
 * Split text nodes containing interpolation markers into separate text nodes.
 * This is done once during template creation.
 * @param {DocumentFragment} fragment
 */
function splitTextNodesWithInterpolation(fragment) {
	const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null)
	let textNode = /** @type {Text | null} */ (walker.nextNode())

	while (textNode) {
		// Collect the next node first, so we don't break iteration when replacing the current node.
		const nextNode = /** @type {Text | null} */ (walker.nextNode())
		const textContent = textNode.textContent || ''

		// Split each text node with an interpolation
		if (textContent.includes(INTERPOLATION_MARKER)) {
			// Check if this text node is a direct child of the template fragment (top level)
			const isTopLevel = textNode.parentNode === fragment
			const parts = textContent.split(INTERPOLATION_REGEXP)
			const parsedParts = parseInterpolationParts(parts, isTopLevel)

			// Only split if we have more than one part (static text + interpolations)
			if (parsedParts.length > 1) {
				const newTextNodes = parsedParts.map(
					part => new Text(typeof part === 'number' ? `${INTERPOLATION_MARKER}${part}${INTERPOLATION_MARKER}` : part),
				)

				// Replace the original text node with the split text nodes
				// (static, interpolated, static, interpolated, etc)
				textNode.replaceWith(...newTextNodes)
			}
		}

		textNode = nextNode
	}
}

/**
 * Create a `<template>` with interpolation markers given the template string parts.
 * @param {TemplateStringsArray} strings
 * @returns {HTMLTemplateElement} A `<template>` element with the DOM
 * representation of the HTML, with interpolation markers in place, to be cloned
 * for any "instance" of the template.
 */
function parseTemplate(strings) {
	let cached = templateCache.get(strings)
	if (cached) return cached

	// Join strings with interpolation markers
	let htmlString = strings.reduce(
		(acc, str, i) => acc + str + (i < strings.length - 1 ? `${INTERPOLATION_MARKER}${i}${INTERPOLATION_MARKER}` : ''),
		'',
	)

	// Preprocessing for case sensitivity: map .someProp to .someprop and remember the original
	const templateId = strings
	const caseMappings = new Map()
	let counter = 0

	// How the case-preserved${count} works:
	// 1. We replace all .someProp, .otherProp, etc with .case-preserved0,
	//    .case-preserved1, etc and store the mapping from .case-preserved0 ->
	//    someProp, .case-preserved1 -> otherProp, etc in caseMappings.
	// 2. Later, when processing the attributes, we can look up the original
	//    case-sensitive property name using the placeholder.
	// 3. This allows us to avoid issues with HTML attribute names being
	//    case-insensitive, while still preserving the original case for JS
	//    property names so we can set them correctly on the elements.
	htmlString = htmlString.replace(JS_PROP_REGEXP, (_, propName) => {
		const placeholder = `.case-preserved${counter}`
		caseMappings.set(placeholder.slice(1), propName) // Store without the dot
		counter++
		return placeholder
	})

	caseMap.set(templateId, caseMappings)

	// Use the standard HTML parser to parse the string into a document
	const parser = new DOMParser()
	const doc = parser.parseFromString(htmlString, 'text/html')

	const parseError = doc.querySelector('parsererror')
	if (parseError) throw new SyntaxError(`HTML parsing error: ${parseError.textContent}`)

	const template = document.createElement('template')

	// Move the nodes from the parsed document to the template content
	const bodyChildren = Array.from(doc.body.childNodes)
	for (const node of bodyChildren) template.content.appendChild(node)

	// Pre-split text nodes that contain interpolation markers
	// This is done once during template creation for better performance
	splitTextNodesWithInterpolation(template.content)

	// Remove empty whitespace-only text nodes, from the top level of the
	// template only, for the convenience of being able to easily get references
	// to top level nodes. This allows usage like the following for a single top
	// level element:
	//
	// ```js
	// const div = html`
	//   <div>
	//     ...
	//   </div>
	// `()
	// ```
	//
	// Text nodes that are not direct children of the template (f.e. inside
	// elements) are not removed, to preserve whitespace where it may be
	// significant.
	//
	// This only removes text nodes that are entirely static whitespace. Text
	// nodes that contain interpolation markers, or non-whitespace content, are
	// preserved. This allows getting access to top level text nodes that may
	// contain important content. For example:
	//
	// ```js
	// const nodes = html`
	//   ${someDynamicContent}
	//   <div>...</div>
	// `()
	// const textNode = nodes[0]; // Access the dynamic text node
	// const div = nodes[1]; // Access the div element
	// ```
	//
	// If you need whitespace to be preserved, consider using explicit markers
	// like `${' '}` for spaces at the top level, or wrapping text in elements.
	// For example:
	//
	// ```js
	// const nodes = html`
	//   <pre>
	//     All text inside elements is preserved, including whitespace.
	//     ${someDynamicContent}
	//   </pre>
	//   ${' '/* this explicit whitespace is preserved */}
	//   <span>...</span>
	//   This text node without whitespace is also preserved.
	// `()
	//
	// const pre = nodes[0];
	// const textNode = nodes[1]; // This is the explicit whitespace text node
	// const span = nodes[2];
	// const textNode2 = nodes[3]; // This is the static text node
	// ```
	//
	// This makes accessing top level nodes easy, based on the visual structure
	// of the template.
	for (const node of template.content.childNodes) {
		if (node.nodeType !== Node.TEXT_NODE) continue
		if (!(node.textContent || '').includes(INTERPOLATION_MARKER) && (node.textContent || '').trim() === '')
			node.parentNode?.removeChild(node)
	}

	templateCache.set(strings, template)
	return template
}

/**
 * Find interpolation sites in template
 * @param {DocumentFragment} fragment
 * @param {TemplateStringsArray} templateId
 * @returns {InterpolationSite[]}
 */
function findInterpolationSites(fragment, templateId) {
	/** @type {InterpolationSite[]} */
	const sites = []
	const caseMappings = caseMap.get(templateId) || new Map()
	const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null)

	let node
	while ((node = walker.nextNode())) {
		if (node.nodeType === Node.TEXT_NODE) {
			const textNode = /** @type {Text} */ (node)
			const textContent = textNode.textContent || ''
			if (textContent.includes(INTERPOLATION_MARKER)) {
				// Since text nodes are now pre-split, each text node should contain exactly one interpolation marker
				// Extract the interpolation index from the marker
				const match = textContent.match(INTERPOLATION_REGEXP)
				if (match) {
					const interpolationIndex = parseInt(match[1])
					textNode.textContent = '' // Clear the text node content; it will be filled during interpolation
					sites.push({node: textNode, type: /** @type {'text'} */ ('text'), interpolationIndex})
				}
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const element = /** @type {Element} */ (node)

			const attributesToRemove = []

			for (const attr of element.attributes) {
				const name = attr.name
				const value = attr.value

				// Handle both interpolated and static special attributes
				if (
					value.includes(INTERPOLATION_MARKER) ||
					name.startsWith('?') ||
					name.startsWith('.') ||
					name.startsWith('@')
				) {
					// Parse attribute value parts (for interpolated content)
					let parsedParts
					if (value.includes(INTERPOLATION_MARKER))
						parsedParts = parseInterpolationParts(value.split(INTERPOLATION_REGEXP), false)
					// Static content
					else parsedParts = [value]

					// Determine attribute type and restore case for JS properties
					/** @type {'attribute'|'boolean-attribute'|'property'|'event'} */
					let type = 'attribute'
					let processedName = name

					if (name.startsWith('?')) {
						type = 'boolean-attribute'
						processedName = name.slice(1) // Remove the question mark
					} else if (name.startsWith('.')) {
						type = 'property'
						const placeholder = name.slice(1) // Remove the dot
						processedName = caseMappings.get(placeholder) || placeholder
					} else if (name.startsWith('@')) {
						type = 'event'
						processedName = name.slice(1) // Remove the at symbol
					}

					sites.push({node: element, type, attributeName: processedName, parts: parsedParts})

					// Remove the template attribute, it will be set dynamically later
					attributesToRemove.push(name)
				}
			}

			for (const name of attributesToRemove) element.removeAttribute(name)
		}
	}

	return sites
}

/**
 * Check if two arrays are equal
 * @param {any[]} a
 * @param {any[]} b
 * @returns {boolean}
 */
function arrayEquals(a, b) {
	if (a.length !== b.length) return false
	for (let i = 0, l = a.length; i < l; i++) if (a[i] !== b[i]) return false
	return true
}

function interpolateTextSite(/** @type {InterpolationSite} */ site, /** @type {InterpolationValue} */ value) {
	// Handle nested templates and DOM elements
	if (value instanceof Node) {
		const insertedNodes = site.insertedNodes

		if (insertedNodes && arrayEquals(insertedNodes, [value])) return // No change

		// Remove previous nodes from a different interpolation
		if (insertedNodes) for (const node of insertedNodes) node.remove()

		// Single DOM node - insert before the text node, hide the text node
		site.node.parentNode?.insertBefore(value, site.node)
		site.node.textContent = '' // Hide the text node (f.e. ${bool ? html`<div></div>` : 'text'} switching from text to DOM)
		site.insertedNodes = [/** @type {Element | Text} */ (value)]
	} else if (Array.isArray(value) && value.length > 0 && value.every(item => item instanceof Node)) {
		const insertedNodes = site.insertedNodes

		if (insertedNodes && arrayEquals(insertedNodes, value)) return // No change

		// Remove previous nodes from a different interpolation
		if (insertedNodes) for (const node of insertedNodes) node.remove()

		// Insert all nodes before the text node
		for (const node of value) site.node.parentNode?.insertBefore(node, site.node)
		site.node.textContent = '' // Hide the text node (f.e. ${bool ? html`<div></div>` : 'text'} switching from text to DOM)
		site.insertedNodes = /** @type {(Element | Text)[]} */ ([...value])
	} else {
		const insertedNodes = site.insertedNodes

		// Remove previous nodes from a different interpolation (f.e. ${bool ? html`<div></div>` : 'text'} switching from DOM to text)
		if (insertedNodes) for (const node of insertedNodes) node.remove()

		// Regular text interpolation
		site.node.textContent = String(value ?? '')
		site.insertedNodes = undefined
	}
}

/**
 * Apply values to interpolation sites
 * @param {InterpolationSite[]} sites
 * @param {InterpolationValue[]} values
 * @param {TemplateKey} currentKey
 */
function applyValues(sites, values, currentKey) {
	for (const site of sites) {
		if (site.type === 'text') {
			// With pre-split text nodes, each text site corresponds to exactly one interpolation
			if (site.interpolationIndex !== undefined) {
				const value = values[site.interpolationIndex]

				// If template function that needs to be called with a key, use
				// the current template's key for the nested template
				if (typeof value === 'function') interpolateTextSite(site, value(currentKey))
				else interpolateTextSite(site, value)
			}
		} else if (site.type === 'attribute') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []

			// Check for nested templates/DOM in attributes - this should throw
			if (
				values.some(
					value =>
						value instanceof Node ||
						(Array.isArray(value) && value.length > 0 && value.some(item => item instanceof Node)) ||
						typeof value === 'function',
				)
			) {
				throw new Error(
					'Nested templates and DOM elements are not allowed in attributes. Use text content interpolation instead.',
				)
			}

			element.setAttribute(site.attributeName || '', joinPartsWithValues(parts, values))
		} else if (site.type === 'boolean-attribute') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []

			let setAttribute = false
			// Pure interpolation - pattern is ['', number, '']
			if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number')
				setAttribute = !!values[parts[1]]
			// Static content - single string part
			else if (parts.length === 1 && typeof parts[0] === 'string') setAttribute = parts[0].trim() !== ''
			// Mixed content - always truthy (has both static and dynamic parts)
			else setAttribute = true

			if (setAttribute) element.setAttribute(site.attributeName || '', '')
			else element.removeAttribute(site.attributeName || '')
		} else if (site.type === 'property') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []

			let propValue
			// Pure interpolation - pattern is ['', number, '']
			if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number')
				propValue = values[parts[1]]
			// Mixed content or static content
			else propValue = joinPartsWithValues(parts, values)

			const propName = site.attributeName || ''
			const anyElement = /** @type {any} */ (element)
			anyElement[propName] = propValue
		} else if (site.type === 'event') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []
			const eventName = site.attributeName || ''

			// Remove previous event listener if it exists
			if (site.currentHandler) {
				element.removeEventListener(eventName, site.currentHandler)
				site.currentHandler = undefined
			}

			let eventListener
			// Pure interpolation - pattern is ['', number, '']
			if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number') {
				// Pure interpolation
				const handler = values[parts[1]]
				if (typeof handler === 'function') eventListener = /** @type {EventListener} */ (handler)
				else if (typeof handler === 'string')
					eventListener = /** @type {EventListener} */ (new Function('event', handler))
				else throw new TypeError(`Event handler for ${eventName} must be a function or string`)
			} else {
				// Mixed content - treat as code string
				const handlerCode = joinPartsWithValues(parts, values)
				eventListener = /** @type {EventListener} */ (new Function('event', handlerCode))
			}

			element.addEventListener(eventName, eventListener)
			site.currentHandler = eventListener
		}
	}
}

/**
 * @typedef {readonly (Element | Text)[]} TemplateNodes
 */

/**
 * @typedef {unknown} InterpolationValue
 */

/**
 * @typedef {unknown} TemplateKey
 */

/**
 * Holds information about a template instance's nodes and interpolation sites.
 *
 * @typedef {{ nodes: TemplateNodes, sites: InterpolationSite[] }} TemplateInstance
 */

/**
 * Holds information about a template instance.
 *
 * @typedef {{
 *   template: HTMLTemplateElement,
 *   instances: Map<TemplateKey, TemplateInstance>
 * }} TemplateEntry
 */

/**
 * Holds information about an interpolation site in the template, f.e. the
 * `${...}` in `<div>${...}</div>` or `<button .onclick=${...}>`.
 *
 * @typedef {{
 *   node: Element | Text,
 *   type: 'text'|'attribute'|'event'|'boolean-attribute'|'property',
 *   attributeName?: string,
 *   parts?: Array<string | number>,
 *   currentHandler?: EventListener,
 *   interpolationIndex?: number,
 *   insertedNodes?: (Element | Text)[]
 * }} InterpolationSite
 */
