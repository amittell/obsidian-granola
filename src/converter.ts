import { ProseMirrorDoc, ProseMirrorNode, GranolaDocument } from './api';

export interface ConvertedNote {
	filename: string;
	content: string;
	frontmatter: NoteFrontmatter;
}

export interface NoteFrontmatter {
	id: string;
	title: string;
	created: string;
	updated: string;
	source: string;
}

export class ProseMirrorConverter {
	convertDocument(doc: GranolaDocument): ConvertedNote {
		const markdown = this.convertProseMirrorToMarkdown(doc.content);
		const frontmatter = this.generateFrontmatter(doc);
		const filename = this.sanitizeFilename(doc.title || `Untitled-${doc.id}`);

		const content = this.generateFileContent(frontmatter, markdown);

		return {
			filename: `${filename}.md`,
			content,
			frontmatter,
		};
	}

	private convertProseMirrorToMarkdown(doc: ProseMirrorDoc): string {
		if (!doc.content || doc.content.length === 0) {
			return '';
		}

		return doc.content
			.map(node => this.convertNode(node))
			.join('\n\n')
			.trim();
	}

	private convertNode(node: ProseMirrorNode): string {
		switch (node.type) {
			case 'paragraph':
				return this.convertParagraph(node);

			case 'heading':
				return this.convertHeading(node);

			case 'bulletList':
			case 'orderedList':
				return this.convertList(node);

			case 'listItem':
				return this.convertListItem(node);

			case 'text':
				return this.convertText(node);

			case 'hardBreak':
				return '\n';

			default:
				// Handle unknown nodes by processing their content
				if (node.content) {
					return node.content.map(child => this.convertNode(child)).join('');
				}
				return node.text || '';
		}
	}

	private convertParagraph(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		return node.content.map(child => this.convertNode(child)).join('');
	}

	private convertHeading(node: ProseMirrorNode): string {
		const level = (node.attrs?.level as number) || 1;
		const headingMarker = '#'.repeat(Math.min(level, 6));

		if (!node.content) {
			return `${headingMarker} `;
		}

		const text = node.content.map(child => this.convertNode(child)).join('');
		return `${headingMarker} ${text}`;
	}

	private convertList(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		const isOrdered = node.type === 'orderedList';

		return node.content
			.map((item, index) => {
				const marker = isOrdered ? `${index + 1}.` : '-';
				const content = this.convertListItem(item);
				return `${marker} ${content}`;
			})
			.join('\n');
	}

	private convertListItem(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		return node.content
			.map(child => {
				if (child.type === 'paragraph') {
					return this.convertParagraph(child);
				}
				return this.convertNode(child);
			})
			.join('\n');
	}

	private convertText(node: ProseMirrorNode): string {
		let text = node.text || '';

		if (node.marks) {
			for (const mark of node.marks) {
				switch (mark.type) {
					case 'strong':
						text = `**${text}**`;
						break;
					case 'em':
						text = `*${text}*`;
						break;
					case 'code':
						text = `\`${text}\``;
						break;
					case 'link': {
						const href = mark.attrs?.href || '#';
						text = `[${text}](${href})`;
						break;
					}
				}
			}
		}

		return text;
	}

	private generateFrontmatter(doc: GranolaDocument): NoteFrontmatter {
		return {
			id: doc.id,
			title: doc.title || 'Untitled',
			created: doc.created_at,
			updated: doc.updated_at,
			source: 'Granola',
		};
	}

	private generateFileContent(frontmatter: NoteFrontmatter, markdown: string): string {
		const yamlFrontmatter = [
			'---',
			`id: ${frontmatter.id}`,
			`title: "${frontmatter.title.replace(/"/g, '\\"')}"`,
			`created: ${frontmatter.created}`,
			`updated: ${frontmatter.updated}`,
			`source: ${frontmatter.source}`,
			'---',
			'',
		].join('\n');

		return yamlFrontmatter + markdown;
	}

	private sanitizeFilename(filename: string): string {
		// Remove or replace invalid filename characters
		return filename
			.replace(/[<>:"/\\|?*]/g, '-')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 100); // Limit length
	}
}
