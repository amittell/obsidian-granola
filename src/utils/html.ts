/**
 * HTML utility functions for decoding entities and other HTML operations
 */

/**
 * Decodes common HTML entities to their corresponding characters.
 * This is a centralized implementation used across the codebase.
 *
 * @param {string} text - Text that may contain HTML entities
 * @returns {string} Text with HTML entities decoded
 *
 * @example
 * ```typescript
 * decodeHtmlEntities('Hello &amp; goodbye');  // Returns: "Hello & goodbye"
 * decodeHtmlEntities('Price: &#163;99.99');   // Returns: "Price: £99.99"
 * ```
 */
export function decodeHtmlEntities(text: string): string {
	const htmlEntities: { [key: string]: string } = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&apos;': "'",
		'&nbsp;': ' ',
		'&copy;': '©',
		'&reg;': '®',
		'&trade;': '™',
		'&euro;': '€',
		'&pound;': '£',
		'&yen;': '¥',
		'&cent;': '¢',
		'&mdash;': '—',
		'&ndash;': '–',
		'&hellip;': '…',
		'&ldquo;': '"',
		'&rdquo;': '"',
		'&lsquo;': "'",
		'&rsquo;': "'",
	};

	// Replace known HTML entities
	let decodedText = text;
	for (const [entity, char] of Object.entries(htmlEntities)) {
		decodedText = decodedText.replace(new RegExp(entity, 'g'), char);
	}

	// Handle numeric entities like &#123; or &#x7B;
	decodedText = decodedText.replace(/&#(\d+);/g, (match, dec) => {
		return String.fromCharCode(parseInt(dec, 10));
	});
	decodedText = decodedText.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
		return String.fromCharCode(parseInt(hex, 16));
	});

	return decodedText;
}
