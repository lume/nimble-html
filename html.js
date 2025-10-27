/**
 * A nimble `html` template tag function for declarative DOM creation and updates.
 *
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {(key: any) => TemplateNodes} A function that accepts a key for
 * template instance identity, and returns DOM nodes rendered with the given
 * values.
 */
export function html(strings, ...values) {
	return handleTemplateTag('html', strings, ...values)
}

/**
 * A nimble `svg` template tag function for declarative SVG DOM creation and updates.
 *
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {(key: any) => TemplateNodes} A function that accepts a key for
 * template instance identity, and returns SVG DOM nodes rendered with the given
 * values.
 */
export function svg(strings, ...values) {
	return handleTemplateTag('svg', strings, ...values)
}

/**
 * A nimble `mathml` template tag function for declarative MathML DOM creation and updates.
 *
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {(key: any) => TemplateNodes} A function that accepts a key for
 * template instance identity, and returns MathML DOM nodes rendered with the given
 * values.
 */
export function mathml(strings, ...values) {
	return handleTemplateTag('mathml', strings, ...values)
}

/** Unique symbol to mark force wrapped values */
const FORCE_SYMBOL = Symbol('force')

/**
 * Wrap a value in `force()` to indicate that it should not be checked for
 * changes when applying updates.
 *
 * @param {InterpolationValue} value
 */
export function force(value) {
	return {[FORCE_SYMBOL]: value}
}

/**
 * Check if a value is wrapped with force()
 * @param {InterpolationValue} value
 * @returns {boolean}
 */
function isForceWrapped(value) {
	return typeof value === 'object' && value !== null && FORCE_SYMBOL in value
}

/**
 * Unwrap a force wrapped value
 * @param {InterpolationValue} value
 * @returns {InterpolationValue}
 */
function unwrapForce(value) {
	if (isForceWrapped(value)) return /** @type {any} */ (value)[FORCE_SYMBOL]
	return value
}

/**
 * Handle force detection and unwrapping for a site
 * @param {InterpolationSite} site
 * @param {InterpolationValue} value
 * @returns {InterpolationValue} The unwrapped value
 */
function handleForceValue(site, value) {
	const isWrapped = isForceWrapped(value)

	if (site.requiresUnwrapping) {
		// This site has been marked as requiring unwrapping
		if (!isWrapped) {
			throw new Error(
				'Value must be wrapped with force() for this interpolation site. Once force() is used at a site, it must always be used.',
			)
		}
		return unwrapForce(value)
	} else if (isWrapped) {
		// First time seeing force at this site
		site.skipEqualityCheck = true
		site.requiresUnwrapping = true
		return unwrapForce(value)
	}

	// Normal value, no unwrapping needed
	return value
}

/**
 * @param {TemplateMode} mode
 * @param {TemplateStringsArray} strings
 * @param {...InterpolationValue} values
 * @returns {(key: any) => TemplateNodes} A function that accepts a key for
 * template instance identity, and returns DOM nodes rendered with the given
 * values.
 */
function handleTemplateTag(mode, strings, ...values) {
	const template = parseTemplate(strings, mode)

	const useFunctionWrapper = true

	if (useFunctionWrapper)
		return function (key = Symbol()) {
			template.values = values
			return template.updateInstance(key)
		}
	else {
		template.values = values
		return template.updateInstance
	}
}

/**
 * Template cache based on template strings (source location)
 * @type {WeakMap<TemplateStringsArray, Template>}
 */
const templateCache = new WeakMap()

/** Unique marker for interpolation sites */
const INTERPOLATION_MARKER = '⧙⧘'

/** RegExp for matching interpolation markers */
const INTERPOLATION_REGEXP = new RegExp(`${INTERPOLATION_MARKER}(\\d+)${INTERPOLATION_MARKER}`)

/** Regex for finding HTML opening/self-closing tags */
const HTML_TAG_REGEXP = /<[^<>]*?\/?>/g

const ATTRIBUTE_END_REGEXP = /[\s=\/>]/

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

class Template {
	/** @type {WeakMap<TemplateKey, TemplateInstance>} */
	instances = new WeakMap()
	el = document.createElement('template')
	caseMappings = new Map()

	/**
	 * @param {TemplateMode} mode
	 * @param {TemplateStringsArray} strings
	 */
	constructor(strings, mode) {
		// Join strings with interpolation markers
		let htmlString = strings.reduce(
			(acc, str, i) => acc + str + (i < strings.length - 1 ? `${INTERPOLATION_MARKER}${i}${INTERPOLATION_MARKER}` : ''),
			'',
		)

		// Wrap content in appropriate root elements for SVG and MathML modes
		// so that the HTML parser creates elements with correct namespaces
		if (mode === 'svg') htmlString = `<svg>${htmlString}</svg>`
		else if (mode === 'mathml') htmlString = `<math>${htmlString}</math>`

		const {caseMappings, el} = this

		// Preprocessing for case sensitivity: map .someProp to .someprop and remember the original
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

		// Scan for HTML tags and process .property attributes within each tag
		htmlString = htmlString.replace(HTML_TAG_REGEXP, tagMatch => {
			// Parse the tag content more carefully to avoid matching dots inside quoted attribute values
			const parts = []
			let lastIndex = 0
			let inQuotes = false
			let quoteChar = ''
			let i = 0

			while (i < tagMatch.length) {
				const char = tagMatch[i]

				if (!inQuotes && (char === '"' || char === "'")) {
					inQuotes = true
					quoteChar = char
				} else if (inQuotes && char === quoteChar) {
					inQuotes = false
					quoteChar = ''
				} else if (!inQuotes && i > 0 && /\s/.test(tagMatch[i - 1])) {
					// Detect attribute patterns when preceded by whitespace and not in quotes
					let prefix = null

					// Detect different attribute patterns
					if (char === '.' || char === '@') {
						// Case 1: .prop or @event (case-sensitive attributes)
						prefix = char
					} else if (char === '!' && i + 1 < tagMatch.length) {
						const nextChar = tagMatch[i + 1]
						// Case 2: !@event (forced case-sensitive event attributes)
						if (nextChar === '.') prefix = '!.'
						// Case 3: !.prop (forced case-sensitive property attributes)
						if (nextChar === '@') prefix = '!@'
						// Case 4: !?attr (forced boolean attributes, no special handling needed)
						else if (nextChar === '?') prefix = null
						// Case 5: !attr (forced regular attributes, no special handling needed)
						else if (/[a-zA-Z]/.test(nextChar)) prefix = null
					}

					// Process case-sensitive attributes
					if (prefix) {
						const startIndex = i
						const attrStartIndex = startIndex + prefix.length
						let attrEnd = attrStartIndex

						while (attrEnd < tagMatch.length && !ATTRIBUTE_END_REGEXP.test(tagMatch[attrEnd])) attrEnd++

						if (attrEnd > attrStartIndex) {
							// Extract the attribute name
							const attrName = tagMatch.slice(attrStartIndex, attrEnd)
							let placeholder

							// Properties and events use case-preserved placeholders
							placeholder = `${prefix}case-preserved${counter}`
							const hasForce = prefix.startsWith('!')
							caseMappings.set(placeholder.slice(hasForce ? 2 : 1), attrName)

							counter++

							// Add the part before this replacement
							parts.push(tagMatch.slice(lastIndex, startIndex))
							parts.push(placeholder) // Add the placeholder (skip ! for case-sensitive attributes)
							lastIndex = attrEnd // Update tracking
							i = attrEnd - 1 // -1 because the loop will increment
						}
					}
				}
				i++
			}

			parts.push(tagMatch.slice(lastIndex)) // Add the remaining part

			return parts.join('')
		})

		// Use the standard HTML parser to parse the string into a template document
		el.innerHTML = htmlString

		// For SVG and MathML templates, unwrap the content from the wrapper
		// element that was added during parsing, and remove the wrapper, to
		// ensure proper namespace handling.
		if (mode === 'svg' || mode === 'mathml') {
			const wrapperElement = /** @type {Element} */ (el.content.firstElementChild)
			wrapperElement.replaceWith(...wrapperElement.childNodes)
		}

		// Pre-split text nodes that contain interpolation markers
		// This is done once during template creation for better performance
		splitTextNodesWithInterpolation(el.content)

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
		for (const node of el.content.childNodes) {
			if (node.nodeType !== Node.TEXT_NODE) continue
			if (!(node.textContent || '').includes(INTERPOLATION_MARKER) && (node.textContent || '').trim() === '')
				node.remove()
		}
	}

	/**
	 * @param {TemplateKey} key The key for the template instance
	 * @returns {TemplateInstance}
	 */
	getInstance(key) {
		let templateInstance = this.instances.get(key)

		// Create a new instance if not cached yet
		if (!templateInstance) {
			// Create a new template instance.
			// We're using importNode instead of cloneNode to ensure that custom
			// elements are properly upgraded immediately when cloned, to avoid
			// users facing issues with un-upgraded elements in templates prior
			// to users connecting the elements to the DOM (issues like a
			// template .prop= expression setting a property before the element
			// is upgraded, shadowing getters/setters and breaking reactivity,
			// causing confusion and frustration).
			const fragment = document.importNode(this.el.content, true) // deep clone

			const sites = findInterpolationSites(fragment, this.caseMappings)
			const nodes = /** @type {TemplateNodes} */ (Object.freeze(Array.from(fragment.childNodes)))

			templateInstance = new TemplateInstance(nodes, sites)

			this.instances.set(key, templateInstance)
		}

		return templateInstance
	}

	/** @type {InterpolationValue[]} */
	values = []

	/**
	 * Update instance with new values. This gets returned by the `html`
	 * function for users to call with their keys.
	 *
	 * @param {TemplateKey=} key
	 */
	updateInstance = (key = Symbol()) => {
		const templateInstance = this.getInstance(key)
		templateInstance.applyValues(this.values)
		return templateInstance.nodes
	}
}

/**
 * Create a Template containing a `<template>` with the DOM representation of
 * the HTML for cloning into "template instances", and other data, associated
 * with the given template strings.
 *
 * @param {TemplateMode} mode
 * @param {TemplateStringsArray} strings
 *
 * @returns {Template} The Template instance contains a `<template>` element
 * with the DOM representation of the HTML, with interpolation markers in place,
 * to be cloned when we create any "instance" of the template.
 */
function parseTemplate(strings, mode) {
	let template = templateCache.get(strings)
	if (!template) templateCache.set(strings, (template = new Template(strings, mode)))
	return template
}

/**
 * Find interpolation sites in template
 * @param {DocumentFragment} fragment
 * @param {Map<string, string>} caseMappings
 * @returns {InterpolationSite[]}
 */
function findInterpolationSites(fragment, caseMappings) {
	/** @type {InterpolationSite[]} */
	const sites = []
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

			// A list of placeholder attributes to remove after finding
			// interpolation sites (f.e. !foo="" is removed, as it will be set
			// dynamically later)
			const attributesToRemove = []

			for (const attr of element.attributes) {
				const name = attr.name
				const value = attr.value

				// Handle both interpolated and static special attributes, plus regular attributes marked with !
				if (
					value.includes(INTERPOLATION_MARKER) ||
					name.startsWith('?') ||
					name.startsWith('.') ||
					name.startsWith('@') ||
					name.startsWith('!')
				) {
					const isStatic = !value.includes(INTERPOLATION_MARKER)

					let parsedParts
					if (isStatic) parsedParts = [value]
					// Parse attribute value parts (for interpolated content)
					else parsedParts = parseInterpolationParts(value.split(INTERPOLATION_REGEXP), false)

					// Determine attribute type and restore case for JS properties
					/** @type {'attribute'|'boolean-attribute'|'property'|'event'} */
					let type = 'attribute'
					let processedName = '' // The name without special prefixes
					let skipEqualityCheck = name.startsWith('!')

					if (name.startsWith('?') || name.startsWith('!?')) {
						type = 'boolean-attribute'
						processedName = name.slice(skipEqualityCheck ? 2 : 1) // Extract the name after ? or !?
					} else if (name.startsWith('.') || name.startsWith('!.')) {
						type = 'property'
						const placeholder = name.slice(skipEqualityCheck ? 2 : 1) // Extract the name after . or !.
						processedName = caseMappings.get(placeholder) || placeholder
					} else if (name.startsWith('@') || name.startsWith('!@')) {
						type = 'event'
						const placeholder = name.slice(skipEqualityCheck ? 2 : 1) // Extract the name after @ or !@
						processedName = caseMappings.get(placeholder) || placeholder
					} else {
						type = 'attribute'
						processedName = skipEqualityCheck ? name.slice(1) : name // Extract name after ! if present
						// Ensure static forced attributes are set initially. Basically !foo="bar" acts like foo="bar".
						if (isStatic && skipEqualityCheck) element.setAttribute(processedName, value)
					}

					/** @type {InterpolationSite} */
					const site = {node: element, type, attributeName: processedName, parts: parsedParts, skipEqualityCheck}

					sites.push(site)

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
	if (!Array.isArray(a) || !Array.isArray(b)) return false
	if (a.length !== b.length) return false
	for (let i = 0, l = a.length; i < l; i++) if (a[i] !== b[i]) return false
	return true
}

/**
 * Cache for generating stable keys for nested template functions
 * Maps interpolation site -> array of stable keys for each index
 * @type {WeakMap<InterpolationSite, symbol[]>}
 */
const siteIndexKeys = new WeakMap()

/**
 * Get a stable unique key for a template function at a specific site and index
 * @param {InterpolationSite} site
 * @param {number} index
 * @returns {symbol}
 */
function getStableNestedKey(site, index) {
	let indexKeys = siteIndexKeys.get(site)
	if (!indexKeys) siteIndexKeys.set(site, (indexKeys = []))
	let key = indexKeys[index]
	if (!key) indexKeys[index] = key = Symbol('nested-template-key' + index)
	return key
}

/**
 * Helper function to clear previously inserted nodes
 * @param {InterpolationSite} site
 */
function clearPreviousNodes(site) {
	if (site.insertedNodes) for (const node of site.insertedNodes) node.remove()
}

/**
 * Helper function to insert nodes and update site state
 * @param {InterpolationSite} site
 * @param {(Element | Text)[]} nodes
 * @param {InterpolationValue} originalValue
 */
function insertNodesAndUpdateSite(site, nodes, originalValue) {
	clearPreviousNodes(site)

	if (nodes.length > 0) {
		// Insert all nodes before the text node
		for (const node of nodes) site.node.parentNode?.insertBefore(node, site.node)
		site.node.textContent = '' // Hide the text node
		site.insertedNodes = [...nodes]
	} else {
		// No nodes to insert - set empty text content
		site.node.textContent = ''
		site.insertedNodes = undefined
	}

	site.cachedValue = originalValue
}

function interpolateTextSite(/** @type {InterpolationSite} */ site, /** @type {InterpolationValue} */ value) {
	// Handle force detection and unwrapping
	const unwrappedValue = handleForceValue(site, value)

	// Handle simple text cases first (most common case)
	if (!(unwrappedValue instanceof Node) && !Array.isArray(unwrappedValue) && typeof unwrappedValue !== 'function') {
		// Simple text content - handle directly without creating extra text nodes
		if (!site.skipEqualityCheck && site.cachedValue === unwrappedValue) return // No change

		clearPreviousNodes(site)
		site.node.textContent = String(unwrappedValue ?? '')
		site.insertedNodes = undefined
		site.cachedValue = unwrappedValue
	} else {
		// Handle complex cases that produce DOM nodes
		// Convert single values to arrays for uniform processing
		const itemsToProcess = Array.isArray(unwrappedValue) ? unwrappedValue : [unwrappedValue]

		const nodes = /** @type {(Element | Text)[]} */ (
			itemsToProcess
				.flatMap((item, index) => {
					// Handle template functions - call them to get their nodes
					if (typeof item === 'function') {
						// Each interpolation site gets its own unique identity for nested template functions.
						// We generate a stable key combining the site identity with the array index to ensure
						// template functions at the same site but different positions don't share cache entries,
						// even when using the same mapper function (e.g., html`<ul>${items.map(itemMapper)}</ul>`).
						const stableKey = getStableNestedKey(site, index)
						const result = item(stableKey)
						return Array.isArray(result) ? result : [result]
					}
					// Handle arrays (already processed template results)
					if (Array.isArray(item)) {
						return item.flat(1) // Flatten one level in case of nested arrays
					}
					// Handle single nodes or primitive values
					return [item]
				})
				.map(item => {
					if (item instanceof Node) return /** @type {Element | Text} */ (item)
					if (item != null && item !== '') return new Text(String(item))
					return null
				})
				.filter(Boolean)
		)

		if (!site.skipEqualityCheck && site.insertedNodes && arrayEquals(site.insertedNodes, nodes)) return // No change
		insertNodesAndUpdateSite(site, nodes, unwrappedValue)
	}
}

/**
 * Holds information about a template instance's nodes and interpolation sites.
 */
class TemplateInstance {
	nodes
	sites

	/**
	 * @param {TemplateNodes} nodes The cloned nodes for this template instance
	 * @param {InterpolationSite[]} sites The interpolation sites in the template
	 */
	constructor(nodes, sites) {
		this.nodes = nodes
		this.sites = sites
	}

	/**
	 * Apply values to interpolation sites
	 * @param {InterpolationValue[]} values
	 */
	applyValues(values) {
		const sites = this.sites

		for (const site of sites) {
			if (site.type === 'text') {
				// With pre-split text nodes, each text site corresponds to exactly one interpolation
				if (site.interpolationIndex !== undefined) {
					const value = values[site.interpolationIndex]
					interpolateTextSite(site, value)
				}
			} else if (site.type === 'attribute') {
				const element = /** @type {Element} */ (site.node)
				const parts = site.parts || []

				// Handle force detection and unwrapping for attribute values
				// Check each interpolated value and handle force detection
				const attributeValues = parts
					.filter(part => typeof part === 'number')
					.map(part => {
						const value = values[part]
						if (isForceWrapped(value)) {
							if (!site.requiresUnwrapping) {
								site.skipEqualityCheck = true
								site.requiresUnwrapping = true
							}
							return unwrapForce(value)
						} else if (site.requiresUnwrapping) {
							throw new Error(
								'Value must be wrapped with force() for this interpolation site. Once force() is used at a site, it must always be used.',
							)
						}
						return value
					})

				if (!site.skipEqualityCheck && arrayEquals(/** @type {unknown[]} */ (site.cachedValue), attributeValues))
					continue // No change

				// Check if any attribute value would produce DOM nodes - not allowed in attributes
				if (
					attributeValues.some(value => value instanceof Node || Array.isArray(value) || typeof value === 'function')
				) {
					throw new Error(
						'Nested templates and DOM elements are not allowed in attributes. Use text content interpolation instead.',
					)
				}

				// Create values array with unwrapped values for string joining
				const processedValues = [...values]
				let attributeValueIndex = 0
				for (const part of parts)
					if (typeof part === 'number') processedValues[part] = attributeValues[attributeValueIndex++]

				const newAttributeValue = joinPartsWithValues(parts, processedValues)
				element.setAttribute(site.attributeName || '', newAttributeValue)
				site.cachedValue = attributeValues
			} else if (site.type === 'boolean-attribute') {
				const element = /** @type {Element} */ (site.node)
				const parts = site.parts || []

				let setAttribute = false
				// Pure interpolation - pattern is ['', number, '']
				if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number')
					setAttribute = !!handleForceValue(site, values[parts[1]])
				// Static content - single string part
				else if (parts.length === 1 && typeof parts[0] === 'string') setAttribute = parts[0].trim() !== ''
				// Mixed content - always truthy (has both static and dynamic parts)
				else setAttribute = true

				if (!site.skipEqualityCheck && site.cachedValue === setAttribute) continue // No change

				if (setAttribute) element.setAttribute(site.attributeName || '', '')
				else element.removeAttribute(site.attributeName || '')

				site.cachedValue = setAttribute
			} else if (site.type === 'property') {
				const element = /** @type {Element} */ (site.node)
				const parts = site.parts || []

				let propValue
				// Pure interpolation - pattern is ['', number, '']
				if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number')
					propValue = handleForceValue(site, values[parts[1]])
				// Mixed content or static content
				else {
					// For mixed content, we need to handle force for each interpolated part
					const processedValues = [...values]
					for (const part of parts)
						if (typeof part === 'number') processedValues[part] = handleForceValue(site, values[part])
					propValue = joinPartsWithValues(parts, processedValues)
				}

				if (!site.skipEqualityCheck && site.cachedValue === propValue) continue // No change

				const propName = site.attributeName || ''
				const anyElement = /** @type {any} */ (element)
				anyElement[propName] = propValue
				site.cachedValue = propValue
			} else if (site.type === 'event') {
				const element = /** @type {Element} */ (site.node)
				const parts = site.parts || []
				const eventName = site.attributeName || ''

				// Determine the current handler value for comparison
				let inputValue
				if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number')
					inputValue = handleForceValue(site, values[parts[1]])
				else {
					// For mixed content, handle force for each interpolated part
					const processedValues = [...values]
					for (const part of parts)
						if (typeof part === 'number') processedValues[part] = handleForceValue(site, values[part])
					inputValue = joinPartsWithValues(parts, processedValues)
				}

				// Only update event handler if it has changed
				if (!site.skipEqualityCheck && site.cachedValue === inputValue) continue // No change

				// Determine the actual event listener to use
				let eventListener
				// Pure interpolation - pattern is ['', number, '']
				if (parts.length === 3 && parts[0] === '' && parts[2] === '' && typeof parts[1] === 'number') {
					// Pure interpolation
					if (typeof inputValue === 'function') eventListener = inputValue
					else if (typeof inputValue === 'string')
						eventListener = /** @type {EventListener} */ (new Function('event', inputValue))
					else if (inputValue == null || inputValue === '' || inputValue === false) eventListener = null
					else throw new TypeError(`Event handler for ${eventName} must be a function or string`)
				} else {
					// Mixed content - treat as code string
					const handlerCode = joinPartsWithValues(parts, values)
					if (handlerCode.trim() === '') eventListener = null
					else eventListener = /** @type {EventListener} */ (new Function('event', handlerCode))
				}

				// Optimized event handler management
				if (eventListener) {
					// We have a valid event listener
					if (!site.internalHandler) {
						// Create a stable wrapper function that calls the current handler
						site.internalHandler = /** @type {EventListener} */ (event => site.currentEventListener?.(event))
						element.addEventListener(eventName, site.internalHandler)
					}
					// Update the current handler reference (no DOM manipulation needed)
					site.currentEventListener = /** @type {EventListener} */ (eventListener)
				} else {
					// We have a falsy event listener, remove the internal handler if it exists
					if (site.internalHandler) {
						element.removeEventListener(eventName, site.internalHandler)
						site.internalHandler = undefined
						site.currentEventListener = undefined
					}
				}

				site.cachedValue = inputValue
			}
		}
	}
}

/** @typedef {readonly (Element | Text)[]} TemplateNodes */
/** @typedef {unknown} InterpolationValue */
/** @typedef {symbol | object | function} WeakMapKey */
/** @typedef {WeakMapKey} TemplateKey */

/**
 * Holds information about an interpolation site in the template, f.e. the
 * `${...}` in `<div>${...}</div>` or `<button .onclick=${...}>`.
 *
 * @typedef {{
 *   node: Element | Text,
 *   type: 'text'|'attribute'|'event'|'boolean-attribute'|'property',
 *   attributeName?: string,
 *   parts?: Array<string | number>,
 *   interpolationIndex?: number,
 *   insertedNodes?: (Element | Text)[],
 *   cachedValue?: unknown,
 *   internalHandler?: EventListener,
 *   currentEventListener?: EventListener,
 *   skipEqualityCheck?: boolean,
 *   requiresUnwrapping?: boolean
 * }} InterpolationSite
 */

/** @typedef { 'html' | 'svg' | 'mathml'} TemplateMode */
