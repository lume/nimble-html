/**
 * Framework-agnostic `html` template tag function.
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {Function} Function that accepts a key and returns DOM nodes
 */
export function html(strings, ...values) {
	const template = parseTemplate(strings)
	const templateId = strings

	// Get or create template entry in instance cache
	let templateEntry = instanceCache.get(templateId)
	if (!templateEntry) instanceCache.set(templateId, (templateEntry = {template, instances: new Map()}))

	return function (/** @type {any} */ key) {
		let nodes
		let sites

		// Check if we already have an instance for this key
		let templateInstance = templateEntry.instances.get(key)
		if (templateInstance) {
			nodes = templateInstance.nodes
			sites = templateInstance.sites
		} else {
			// Create new instance
			const fragment = /** @type {DocumentFragment} */ (template.content.cloneNode(true))

			sites = findInterpolationSites(fragment, templateId)
			nodes = Array.from(fragment.childNodes)

			// Store both nodes and sites for future updates
			templateEntry.instances.set(key, {nodes, sites})
		}

		// Update instance with new values
		applyValues(sites, values)

		return nodes.length === 1 ? nodes[0] : nodes
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

/**
 * Map to store original case for property names
 * @type {Map<TemplateStringsArray, Map<string, string>>}
 */
const caseMap = new Map()

/**
 * Parse parts array, converting alternating indices to numbers
 * @param {string[]} parts
 * @returns {(string|number)[]}
 */
function parseInterpolationParts(parts) {
	return parts.map((part, i) => (i % 2 === 1 ? parseInt(part) : part))

	// .filter(part => typeof part === 'number' || part.trim() !== '')
	// @copilot ^ when the previous line is commented out, the "Basic text
	// interpolation" test passes and some tests fail. When this is not
	// commented out, the "Basic text interpolation" test fails and other tests
	// pass. The goal is to leave whitespace text as-is, and we don't want to
	// filter anything out.  What we want is for code like this:
	//
	// ```js
	// const div = html`
	//     <div>
	//         value: ${value}
	//     </div>
	// `(key)
	// ```
	//
	// to preserve the whitespace inside the `<div>...</div>`. The div should
	// have three text nodes:
	//
	// 1. `\n        value: `
	// 2. `${value}`
	// 3. `\n    `
	//
	// We only remove whitespace-only text nodes that are not inside an element
	// but at the top level of the template, in the `parseTemplate` function.
	// See the note there.
	//
	// Fix the code so that it preserves all parts, including whitespace, and
	// dynamic text nodes map one-to-one with their interpolation values.
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

/** This regex matches . followed by a JS identifier. */
const JS_PROP_REGEXP = /\.([A-Za-z][A-Za-z0-9]*)/g

/**
 * Create a <template> with interpolation markers given the template string parts.
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
	bodyChildren.forEach(node => template.content.appendChild(node))

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
	const sites = []
	const caseMappings = caseMap.get(templateId) || new Map()
	const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null)

	let node
	while ((node = walker.nextNode())) {
		if (node.nodeType === Node.TEXT_NODE) {
			const textContent = node.textContent || ''
			if (textContent.includes(INTERPOLATION_MARKER)) {
				// Parse interpolation indices
				const parts = textContent.split(INTERPOLATION_REGEXP)
				const parsedParts = parseInterpolationParts(parts)

				sites.push({node, type: /** @type {'text'} */ ('text'), parts: parsedParts})
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const element = /** @type {Element} */ (node)
			const attributes = Array.from(element.attributes)

			attributes.forEach(attr => {
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
						parsedParts = parseInterpolationParts(value.split(INTERPOLATION_REGEXP))
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

					// Remove the template attribute
					element.removeAttribute(name)
				}
			})
		}
	}

	return sites
}

/**
 * Apply values to interpolation sites
 * @param {InterpolationSite[]} sites
 * @param {InterpolationValue[]} values
 */
function applyValues(sites, values) {
	sites.forEach(site => {
		if (site.type === 'text') {
			site.node.textContent = joinPartsWithValues(site.parts || [], values)
		} else if (site.type === 'attribute') {
			const element = /** @type {Element} */ (site.node)
			element.setAttribute(site.attributeName || '', joinPartsWithValues(site.parts || [], values))
		} else if (site.type === 'boolean-attribute') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []

			let value = null
			// Pure interpolation - boolean logic
			if (parts.length === 1 && typeof parts[0] === 'number') value = values[parts[0]]
			// Static content - check if string is truthy (non-empty)
			else if (parts.length === 1 && typeof parts[0] === 'string') value = parts[0]
			// Mixed content - always truthy (has both static and dynamic parts)
			else value = joinPartsWithValues(parts, values)

			if (value) element.setAttribute(site.attributeName || '', '')
			else element.removeAttribute(site.attributeName || '')
		} else if (site.type === 'property') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []
			const propValue =
				parts.length === 1 && typeof parts[0] === 'number' ? values[parts[0]] : joinPartsWithValues(parts, values)
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
			if (parts.length === 1 && typeof parts[0] === 'number') {
				// Pure interpolation
				const handler = values[parts[0]]
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
	})
}

/**
 * @typedef {unknown} InterpolationValue
 */

/**
 * @typedef {unknown} TemplateKey
 */

/**
 * Holds information about a template instance's nodes and interpolation sites.
 *
 * @typedef {{ nodes: Node[], sites: InterpolationSite[] }} TemplateInstance
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
 *   node: Node,
 *   type: 'text'|'attribute'|'event'|'boolean-attribute'|'property',
 *   attributeName?: string,
 *   parts?: Array<string | number>,
 *   currentHandler?: EventListener
 * }} InterpolationSite
 */
