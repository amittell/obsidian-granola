import { DocumentMetadataService } from '../../src/services/document-metadata';
import { GranolaDocument } from '../../src/api';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('HTML Entity Decoding in UI', () => {
	const mockDocument: GranolaDocument = {
		id: 'test-123',
		title: 'RFP Updates &amp; Next Steps',
		created_at: '2024-01-01T10:00:00Z',
		updated_at: '2024-01-01T10:00:00Z',
		user_id: 'user-123',
		notes: { type: 'doc', content: [] },
		notes_plain: 'Test content',
		notes_markdown: '# Test',
	};

	describe('DocumentMetadataService', () => {
		it('should decode HTML entities in titles', () => {
			const metadataService = new DocumentMetadataService(DEFAULT_SETTINGS);
			const metadata = metadataService.extractMetadata(mockDocument, {
				status: 'NEW',
				reason: 'Not yet imported',
				requiresUserChoice: false,
			});

			expect(metadata.title).toBe('RFP Updates & Next Steps');
			expect(metadata.title).not.toContain('&amp;');
		});

		it('should handle multiple HTML entities', () => {
			const docWithMultipleEntities: GranolaDocument = {
				...mockDocument,
				title: 'Q&amp;A Session &lt;Important&gt; &quot;Notes&quot;',
			};

			const metadataService = new DocumentMetadataService(DEFAULT_SETTINGS);
			const metadata = metadataService.extractMetadata(docWithMultipleEntities, {
				status: 'NEW',
				reason: 'Not yet imported',
				requiresUserChoice: false,
			});

			expect(metadata.title).toBe('Q&A Session <Important> "Notes"');
		});

		it('should handle numeric HTML entities', () => {
			const docWithNumericEntities: GranolaDocument = {
				...mockDocument,
				title: 'Meeting &#38; Discussion &#x26; Planning',
			};

			const metadataService = new DocumentMetadataService(DEFAULT_SETTINGS);
			const metadata = metadataService.extractMetadata(docWithNumericEntities, {
				status: 'NEW',
				reason: 'Not yet imported',
				requiresUserChoice: false,
			});

			expect(metadata.title).toBe('Meeting & Discussion & Planning');
		});
	});

	describe('UI Modal Title Display', () => {
		it('should use decoded titles from metadata in document selection modal', () => {
			const metadataService = new DocumentMetadataService(DEFAULT_SETTINGS);

			// Create metadata with decoded title
			const metadata = metadataService.extractMetadata(mockDocument, {
				status: 'NEW',
				reason: 'Not yet imported',
				requiresUserChoice: false,
			});

			// The modal should use the metadata's decoded title, not the raw document title
			expect(metadata.title).toBe('RFP Updates & Next Steps');
			expect(metadata.title).not.toBe(mockDocument.title);
		});

		it('should use decoded titles from metadata in conflict resolution modal', () => {
			const metadataService = new DocumentMetadataService(DEFAULT_SETTINGS);

			// Create metadata with decoded title
			const metadata = metadataService.extractMetadata(mockDocument, {
				status: 'CONFLICT',
				reason: 'Local modifications detected',
				requiresUserChoice: true,
			});

			// The modal should use the metadata's decoded title
			expect(metadata.title).toBe('RFP Updates & Next Steps');
			expect(metadata.title).not.toContain('&amp;');
		});
	});
});
