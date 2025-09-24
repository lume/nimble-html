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

/**
 * Map to store original case for property names
 * @type {Map<TemplateStringsArray, Map<string, string>>}
 */
const caseMap = new Map()

/**
 * Parse HTML template with interpolation markers
 * @param {TemplateStringsArray} strings
 * @returns {HTMLTemplateElement}
 */
function parseTemplate(strings) {
	let cached = templateCache.get(strings)
	if (cached) return cached

	// Join strings with interpolation markers
	let htmlString = strings.reduce((acc, str, i) => {
		return acc + str + (i < strings.length - 1 ? `${INTERPOLATION_MARKER}${i}${INTERPOLATION_MARKER}` : '')
	}, '')

	// Preprocessing for case sensitivity: map .someProp to .someprop and remember the original
	const templateId = strings
	const caseMappings = new Map()
	let counter = 0

	htmlString = htmlString.replace(/\.([A-Za-z][A-Za-z0-9]*)/g, (_, propName) => {
		const placeholder = `.casepreserved${counter}`
		caseMappings.set(placeholder.slice(1), propName) // Store without the dot
		counter++
		return placeholder
	})

	caseMap.set(templateId, caseMappings)

	// Use DOMParser to parse the HTML
	const parser = new DOMParser()
	const doc = parser.parseFromString(htmlString, 'text/html')

	// Check for parsing errors
	const parseError = doc.querySelector('parsererror')
	if (parseError) {
		throw new SyntaxError(`HTML parsing error: ${parseError.textContent}`)
	}

	// Create template element
	const template = document.createElement('template')

	// Move body contents to template
	const bodyChildren = Array.from(doc.body.childNodes)
	bodyChildren.forEach(node => template.content.appendChild(node))

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
				const parts = textContent.split(new RegExp(`${INTERPOLATION_MARKER}(\\d+)${INTERPOLATION_MARKER}`))
				const parsedParts = parts
					.map((part, i) => {
						return i % 2 === 1 ? parseInt(part) : part
					})
					.filter(part => typeof part === 'number' || part.trim() !== '')

				sites.push({
					node,
					type: /** @type {'text'} */ ('text'),
					parts: parsedParts,
				})
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
					if (value.includes(INTERPOLATION_MARKER)) {
						const parts = value.split(new RegExp(`${INTERPOLATION_MARKER}(\\d+)${INTERPOLATION_MARKER}`))
						parsedParts = parts
							.map((part, i) => {
								return i % 2 === 1 ? parseInt(part) : part
							})
							.filter(part => typeof part === 'number' || part.trim() !== '')
					} else {
						// Static content
						parsedParts = [value]
					}

					// Determine attribute type and restore case for properties
					/** @type {'attribute'|'boolean-attribute'|'property'|'event'} */
					let type = 'attribute'
					let processedName = name

					if (name.startsWith('?')) {
						type = 'boolean-attribute'
						processedName = name.slice(1)
					} else if (name.startsWith('.')) {
						type = 'property'
						const placeholder = name.slice(1) // Remove the dot
						processedName = caseMappings.get(placeholder) || placeholder
					} else if (name.startsWith('@')) {
						type = 'event'
						processedName = name.slice(1)
					}

					sites.push({
						node: element,
						type,
						attributeName: processedName,
						parts: parsedParts,
					})

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
			const textValue = (site.parts || [])
				.map((/** @type {string|number} */ part) => {
					return typeof part === 'number' ? String(values[part] ?? '') : part
				})
				.join('')
			site.node.textContent = textValue
		} else if (site.type === 'attribute') {
			const element = /** @type {Element} */ (site.node)
			const attrValue = (site.parts || [])
				.map((/** @type {string|number} */ part) => {
					return typeof part === 'number' ? String(values[part] ?? '') : part
				})
				.join('')
			element.setAttribute(site.attributeName || '', attrValue)
		} else if (site.type === 'boolean-attribute') {
			const element = /** @type {Element} */ (site.node)

			const parts = site.parts || []
			if (parts.length === 1 && typeof parts[0] === 'number') {
				// Pure interpolation - boolean logic
				const value = values[parts[0]]
				if (value) {
					element.setAttribute(site.attributeName || '', '')
				} else {
					element.removeAttribute(site.attributeName || '')
				}
			} else if (parts.length === 1 && typeof parts[0] === 'string') {
				// Static content - check if string is truthy (non-empty)
				const value = parts[0]
				if (value && value.trim() !== '') {
					element.setAttribute(site.attributeName || '', '')
				} else {
					element.removeAttribute(site.attributeName || '')
				}
			} else {
				// Mixed content - always truthy (has both static and dynamic parts)
				const attrValue = parts
					.map((/** @type {string|number} */ part) => {
						return typeof part === 'number' ? String(values[part] ?? '') : part
					})
					.join('')
				element.setAttribute(site.attributeName || '', attrValue)
			}
		} else if (site.type === 'property') {
			const element = /** @type {Element} */ (site.node)
			const parts = site.parts || []
			const propValue =
				parts.length === 1 && typeof parts[0] === 'number'
					? values[parts[0]]
					: parts
							.map((/** @type {string|number} */ part) => {
								return typeof part === 'number' ? String(values[part] ?? '') : part
							})
							.join('')
			const attrName = site.attributeName || ''
			;/** @type {any} */ (element)[attrName] = propValue
		} else if (site.type === 'event') {
			const element = /** @type {Element} */ (site.node)

			const parts = site.parts || []
			const eventName = site.attributeName || ''

			// Remove previous event listener if it exists
			if (site.currentHandler) {
				element.removeEventListener(eventName, site.currentHandler)
				site.currentHandler = undefined
			}

			if (parts.length === 1 && typeof parts[0] === 'number') {
				// Pure interpolation
				const handler = values[parts[0]]
				if (typeof handler === 'function') {
					const eventListener = /** @type {EventListener} */ (handler)
					element.addEventListener(eventName, eventListener)
					site.currentHandler = eventListener
				} else if (typeof handler === 'string') {
					const eventListener = /** @type {EventListener} */ (new Function('event', handler))
					element.addEventListener(eventName, eventListener)
					site.currentHandler = eventListener
				} else {
					throw new TypeError(`Event handler for ${eventName} must be a function or string`)
				}
			} else {
				// Mixed content - treat as code string
				const handlerCode = parts
					.map((/** @type {string|number} */ part) => {
						return typeof part === 'number' ? String(values[part] ?? '') : part
					})
					.join('')
				const eventListener = /** @type {EventListener} */ (new Function('event', handlerCode))
				element.addEventListener(eventName, eventListener)
				site.currentHandler = eventListener
			}
		}
	})
}

/**
 * Framework-agnostic `html` template tag function.
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {Function} Function that accepts a key and returns DOM nodes
 */
export function html(strings, ...values) {
	const template = parseTemplate(strings)
	const templateId = strings

	return function (/** @type {any} */ key) {
		// Get or create template entry in instance cache
		let templateEntry = instanceCache.get(templateId)
		if (!templateEntry) {
			templateEntry = {template, instances: new Map()}
			instanceCache.set(templateId, templateEntry)
		}

		// Check if we already have an instance for this key
		let existingData = templateEntry.instances.get(key)
		if (existingData) {
			// Update existing instance with new values by applying to cached sites
			applyValues(existingData.sites, values)
			return existingData.nodes.length === 1 ? existingData.nodes[0] : existingData.nodes
		}

		// Create new instance
		const fragment = /** @type {DocumentFragment} */ (template.content.cloneNode(true))

		// Remove empty text nodes (whitespace-only) before finding sites
		const nodesToRemove = []
		const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null)
		let textNode
		while ((textNode = walker.nextNode())) {
			if (!textNode.textContent?.includes(INTERPOLATION_MARKER) && (textNode.textContent || '').trim() === '') {
				nodesToRemove.push(textNode)
			}
		}
		nodesToRemove.forEach(node => node.parentNode?.removeChild(node))

		const sites = findInterpolationSites(fragment, templateId)
		applyValues(sites, values)

		const nodes = Array.from(fragment.childNodes)

		// Store both nodes and sites for future updates
		templateEntry.instances.set(key, {nodes, sites})

		return nodes.length === 1 ? nodes[0] : nodes
	}
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
