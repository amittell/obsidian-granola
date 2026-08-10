import {
	DuplicateDetector,
	ImportStatus,
	DuplicateCheckResult,
} from '../../src/services/duplicate-detector';
import { GranolaDocument } from '../../src/api';
import { TFile, Vault } from 'obsidian';

// Mock Obsidian Vault
const mockVault = {
	getMarkdownFiles: jest.fn(),
	read: jest.fn(),
} as Vault;

// Mock TFile
const createMockFile = (name: string, path: string = name): TFile => {
	const file = Object.create(TFile.prototype);
	Object.assign(file, {
		name,
		path,
		basename: name.replace('.md', ''),
		extension: 'md',
		parent: null,
		vault: mockVault,
		stat: { ctime: 0, mtime: 0, size: 0 },
	});
	return file;
};

describe('DuplicateDetector', () => {
	let detector: DuplicateDetector;
	let mockDocument: GranolaDocument;

	beforeEach(() => {
		detector = new DuplicateDetector(mockVault);

		// Suppress console output during tests
		jest.spyOn(console, 'log').mockImplementation();
		jest.spyOn(console, 'warn').mockImplementation();
		jest.spyOn(console, 'error').mockImplementation();

		mockDocument = {
			id: 'test-doc-1',
			title: 'Test Document',
			created_at: '2023-01-01T10:00:00Z',
			updated_at: '2023-01-02T15:30:00Z',
			user_id: 'user-123',
			notes_plain: 'This is a test document.',
			notes_markdown: '# Test Document\n\nThis is a test document.',
			notes: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'This is a test document.' }],
					},
				],
			},
			last_viewed_panel: {
				content: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'This is a test document.' }],
						},
					],
				},
			},
		};

		// Reset mocks
		jest.clearAllMocks();
	});

	describe('initialize', () => {
		it('should initialize successfully with no existing documents', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();

			expect(mockVault.getMarkdownFiles).toHaveBeenCalled();
		});

		it('should scan and detect existing Granola documents', async () => {
			const mockFile = createMockFile('2023-01-01 - Test Document.md');
			const granolaContent = `---
id: test-doc-1
title: "Test Document"
created: 2023-01-01T10:00:00Z
updated: 2023-01-02T15:30:00Z
source: Granola
---

# Test Document

This is content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.initialize();

			expect(mockVault.read).toHaveBeenCalledWith(mockFile);
		});

		it('should handle vault scanning errors gracefully', async () => {
			const mockFile = createMockFile('error-file.md');
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockRejectedValue(new Error('Read error'));

			// Should not throw - should continue scanning other files
			await detector.initialize();

			expect(mockVault.read).toHaveBeenCalledWith(mockFile);
		});

		it('should only initialize once', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			await detector.initialize(); // Second call

			expect(mockVault.getMarkdownFiles).toHaveBeenCalledTimes(1);
		});
	});

	describe('refresh', () => {
		it('should re-scan the vault when refreshed', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			await detector.refresh();

			expect(mockVault.getMarkdownFiles).toHaveBeenCalledTimes(2);
		});
	});

	describe('checkDocument', () => {
		beforeEach(async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);
			await detector.initialize();
		});

		it('should return NEW status for non-existing document', async () => {
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('NEW');
			expect(result.reason).toBe('Document not found in vault');
			expect(result.requiresUserChoice).toBe(false);
		});

		it('should detect existing document by ID', async () => {
			const mockFile = createMockFile('2023-01-01 - Test Document.md');
			const granolaContent = `---
id: test-doc-1
title: "Test Document"
created: 2023-01-01T10:00:00Z
updated: 2023-01-01T15:30:00Z
source: Granola
---

# Test Document`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('UPDATED');
			expect(result.existingFile).toBe(mockFile);
		});

		it('should return EXISTS status for same version', async () => {
			const mockFile = createMockFile('2023-01-01 - Test Document.md');
			const granolaContent = `---
id: test-doc-1
title: "Test Document"
created: 2023-01-01T10:00:00Z
updated: 2023-01-02T15:30:00Z
source: Granola
---

# Test Document`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('EXISTS');
			expect(result.existingFile).toBe(mockFile);
		});

		it('should return CONFLICT status for documents with local modifications', async () => {
			const mockFile = createMockFile('2023-01-01 - Test Document.md');
			const granolaContent = `---
id: test-doc-1
title: "Test Document"
created: 2023-01-01T10:00:00Z
updated: 2023-01-01T15:30:00Z
source: Granola
---

# Test Document

Original content.

## Notes

[[User added link]] and custom content here.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('CONFLICT');
			expect(result.requiresUserChoice).toBe(true);
		});

		it('should detect filename conflicts with existing files', async () => {
			const conflictingFile = createMockFile('2023-01-01 - Test Document.md');
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([conflictingFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(
				'Regular markdown file without Granola frontmatter'
			);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('CONFLICT');
			expect(result.existingFile).toBe(conflictingFile);
			expect(result.reason).toContain('File already exists');
		});

		it('should handle old format filename conflicts', async () => {
			const conflictingFile = createMockFile('Test Document.md');
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([conflictingFile]);
			(mockVault.read as jest.Mock).mockResolvedValue('Regular markdown file');

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('CONFLICT');
			expect(result.existingFile).toBe(conflictingFile);
		});
	});

	describe('checkDocuments', () => {
		it('should check multiple documents efficiently', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			const documents = [
				mockDocument,
				{ ...mockDocument, id: 'doc2', title: 'Second Document' },
			];

			const results = await detector.checkDocuments(documents);

			expect(results.size).toBe(2);
			expect(results.get('test-doc-1')?.status).toBe('NEW');
			expect(results.get('doc2')?.status).toBe('NEW');
		});
	});

	describe('getStatistics', () => {
		it('should return empty statistics when no documents exist', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);
			await detector.initialize();

			const stats = detector.getStatistics();

			expect(stats.totalGranolaDocuments).toBe(0);
			expect(stats.oldestDocument).toBeNull();
			expect(stats.newestDocument).toBeNull();
			expect(stats.documentsWithConflicts).toBe(0);
		});

		it('should calculate statistics correctly', async () => {
			const mockFiles = [createMockFile('doc1.md'), createMockFile('doc2.md')];

			const contents = [
				`---
id: doc1
title: "Doc 1"
updated: 2023-01-01T10:00:00Z
source: Granola
---
Content`,
				`---
id: doc2
title: "Doc 2"
updated: 2023-01-02T10:00:00Z
source: Granola
---
Content with [[user modifications]]`,
			];

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue(mockFiles);
			(mockVault.read as jest.Mock)
				.mockResolvedValueOnce(contents[0])
				.mockResolvedValueOnce(contents[1]);

			await detector.initialize();
			const stats = detector.getStatistics();

			expect(stats.totalGranolaDocuments).toBe(2);
			expect(stats.oldestDocument).toBe('2023-01-01T10:00:00Z');
			expect(stats.newestDocument).toBe('2023-01-02T10:00:00Z');
			expect(stats.documentsWithConflicts).toBe(1); // doc2 has Obsidian link
		});
	});

	describe('frontmatter parsing', () => {
		it('should extract Granola metadata correctly', async () => {
			const mockFile = createMockFile('test.md');
			const granolaContent = `---
id: test-doc-1
title: "Test Document"
created: 2023-01-01T10:00:00Z
updated: 2023-01-02T15:30:00Z
source: Granola
tags: [meeting, notes]
---

# Content here`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.initialize();
			const result = await detector.checkDocument(mockDocument);

			// Since both documents have the same updated date (2023-01-02T15:30:00Z), status should be EXISTS
			expect(result.status).toBe('EXISTS');
		});

		it('should ignore non-Granola documents', async () => {
			const mockFile = createMockFile('regular.md');
			const regularContent = `---
title: "Regular Document"
tags: [note]
---

# Regular content`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(regularContent);

			await detector.initialize();
			// Should not detect any Granola documents
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('NEW');
		});

		it('should handle malformed frontmatter gracefully', async () => {
			const mockFile = createMockFile('malformed.md');
			const malformedContent = `---
id: incomplete
source: Granola
# missing closing ---

Content here`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(malformedContent);

			await detector.initialize();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('NEW');
		});
	});

	describe('local modification detection', () => {
		it('should detect Obsidian-specific patterns', async () => {
			const patterns = [
				'Content with [[internal link]]',
				'Content with ![[embed]]',
				'Content with #hashtag',
				'Content with %%comment%%',
				'Content with ```dataview\nquery\n```',
				'Content with block reference ^abc123',
			];

			for (const content of patterns) {
				const mockFile = createMockFile('test.md');
				const granolaContent = `---
id: test-doc-1
title: "Test"
updated: 2023-01-01T10:00:00Z
source: Granola
---

${content}`;

				(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
				(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

				await detector.refresh();
				const result = await detector.checkDocument(mockDocument);

				expect(result.status).toBe('CONFLICT');
			}
		});

		it('should detect structural changes', async () => {
			const mockFile = createMockFile('test.md');
			const granolaContent = `---
id: test-doc-1
title: "Test"
updated: 2023-01-01T10:00:00Z
source: Granola
---

## Notes
User added notes here`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			// The structural changes detection should identify this as having local modifications
			// and return CONFLICT status since hasLocalModifications takes precedence over date comparison
			expect(result.status).toBe('CONFLICT');
			expect(result.reason).toBe('Local modifications detected - requires user choice');
		});

		it('should detect very long content as potential user additions', async () => {
			const mockFile = createMockFile('test.md');
			const longContent = 'word '.repeat(2100); // Over 2000 words
			const granolaContent = `---
id: test-doc-1
title: "Test"
updated: 2023-01-01T10:00:00Z
source: Granola
---

${longContent}`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(granolaContent);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('CONFLICT');
		});

		it('should not flag normal Granola content as modified', async () => {
			const mockFile = createMockFile('test.md');
			const normalContent = `---
id: test-doc-1
title: "Test"
updated: 2023-01-01T10:00:00Z
source: Granola
---

# Meeting Notes

Regular meeting content here with some bullet points:
- Point 1
- Point 2
- Point 3

Normal paragraph text without any special Obsidian patterns.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(normalContent);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('UPDATED'); // Not CONFLICT
		});
	});

	describe('filename generation', () => {
		it('should generate correct date-prefixed filenames', async () => {
			const doc = {
				...mockDocument,
				created_at: '2023-05-15T14:30:00Z',
				title: 'Special Characters: Test/File',
			};

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			const result = await detector.checkDocument(doc);

			// Should check for conflicts with both old and new format filenames
			expect(result.status).toBe('NEW');
		});

		it('should handle invalid dates in filename generation', async () => {
			const doc = {
				...mockDocument,
				created_at: 'invalid-date',
				title: 'Test Document',
			};

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			const result = await detector.checkDocument(doc);

			expect(result.status).toBe('NEW');
		});

		it('should sanitize special characters in filenames', async () => {
			const doc = {
				...mockDocument,
				title: 'Test<>:"/\\|?*Document',
			};

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			const result = await detector.checkDocument(doc);

			expect(result.status).toBe('NEW');
		});

		it('should handle very long titles', async () => {
			const doc = {
				...mockDocument,
				title: 'A'.repeat(200), // Very long title
			};

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			const result = await detector.checkDocument(doc);

			expect(result.status).toBe('NEW');
		});

		it('should handle empty or missing titles', async () => {
			const doc = {
				...mockDocument,
				title: '',
			};

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();
			const result = await detector.checkDocument(doc);

			expect(result.status).toBe('NEW');
		});
	});

	describe('granola_url ID recovery', () => {
		const uuid = '01890a5d-ac96-774b-bcce-b302099a8057';
		let docWithUuid: GranolaDocument;

		beforeEach(() => {
			docWithUuid = { ...mockDocument, id: uuid };
		});

		it('should recover the Granola ID from granola_url when id is absent', async () => {
			// Frontmatter shape written when enhanced frontmatter is OFF but
			// "include Granola URL" is ON (no id/updated/title fields)
			const mockFile = createMockFile('2026-08-05 - QNTM Sync.md');
			const content = `---
created: 2026-08-05T14:30:00Z
source: Granola
granola_url: https://notes.granola.ai/d/${uuid}
tags:
  - meeting
---

# QNTM Sync

Meeting content here.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(docWithUuid);

			expect(result.status).toBe('EXISTS');
			expect(result.existingFile).toBe(mockFile);
		});

		it('should treat updated and title as optional when id is present', async () => {
			const mockFile = createMockFile('2023-01-01 - Test Document.md');
			const content = `---
id: test-doc-1
created: 2023-01-01T10:00:00Z
source: Granola
---

# Test Document`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('EXISTS');
			expect(result.existingFile).toBe(mockFile);
		});

		it('should identify renamed notes by ID and never by filename', async () => {
			// Filename bears no relation to the document title or date
			const mockFile = createMockFile('Renamed by Ally.md');
			const content = `---
created: 2026-08-05T14:30:00Z
source: Granola
granola_url: https://notes.granola.ai/d/${uuid}
---

Meeting content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(docWithUuid);

			expect(result.status).toBe('EXISTS');
			expect(result.existingFile).toBe(mockFile);
		});

		it('should classify notes without an updated timestamp as EXISTS even when Granola is newer', async () => {
			const mockFile = createMockFile('note.md');
			const content = `---
created: 2023-01-01T10:00:00Z
source: Granola
granola_url: https://notes.granola.ai/d/${uuid}
---

Content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const newerDoc = { ...docWithUuid, updated_at: '2026-12-31T00:00:00Z' };
			const result = await detector.checkDocument(newerDoc);

			expect(result.status).toBe('EXISTS');
		});

		it('should not flag legacy notes without updated timestamps as conflicts', async () => {
			// Legacy notes are routinely edited (wikilinks, tags) after import;
			// without an updated timestamp there is nothing to compare, so they
			// must show as EXISTS rather than CONFLICT
			const mockFile = createMockFile('note.md');
			const content = `---
created: 2023-01-01T10:00:00Z
source: Granola
granola_url: https://notes.granola.ai/d/${uuid}
---

Discussed [[QNTM Rollout]] with the team. #followup`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(docWithUuid);

			expect(result.status).toBe('EXISTS');
		});

		it('should recognize notes with granola_url but no source field', async () => {
			const mockFile = createMockFile('note.md');
			const content = `---
created: 2023-01-01T10:00:00Z
granola_url: https://notes.granola.ai/d/${uuid}
---

Content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(docWithUuid);

			expect(result.status).toBe('EXISTS');
		});

		it('should not match documents against notes with a different granola_url UUID', async () => {
			const mockFile = createMockFile('Some Other Meeting.md');
			const content = `---
created: 2023-01-01T10:00:00Z
source: Granola
granola_url: https://notes.granola.ai/d/ffffffff-0000-0000-0000-000000000000
---

Content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(docWithUuid);

			expect(result.status).toBe('NEW');
		});

		it('should parse quoted frontmatter values written by Linter-style formatters', async () => {
			const mockFile = createMockFile('note.md');
			const content = `---
created: "2026-08-05T14:30:00Z"
source: "Granola"
granola_url: "https://notes.granola.ai/d/${uuid}"
---

Content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			await detector.refresh();
			const result = await detector.checkDocument(docWithUuid);

			expect(result.status).toBe('EXISTS');
		});

		it('should exclude notes without updated timestamps from oldest/newest statistics', async () => {
			const datedFile = createMockFile('dated.md');
			const undatedFile = createMockFile('undated.md');
			const datedContent = `---
id: dated-doc
updated: 2023-06-01T10:00:00Z
source: Granola
---
Content`;
			const undatedContent = `---
created: 2023-01-01T10:00:00Z
source: Granola
granola_url: https://notes.granola.ai/d/${uuid}
---
Content`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([datedFile, undatedFile]);
			(mockVault.read as jest.Mock)
				.mockResolvedValueOnce(datedContent)
				.mockResolvedValueOnce(undatedContent);

			await detector.initialize();
			const stats = detector.getStatistics();

			expect(stats.totalGranolaDocuments).toBe(2);
			expect(stats.oldestDocument).toBe('2023-06-01T10:00:00Z');
			expect(stats.newestDocument).toBe('2023-06-01T10:00:00Z');
		});
	});

	describe('metadataCache frontmatter parsing', () => {
		const uuid = '01890a5d-ac96-774b-bcce-b302099a8057';

		it('should prefer metadataCache frontmatter over content parsing', async () => {
			const mockFile = createMockFile('cached.md');
			const mockCache = {
				getFileCache: jest.fn().mockReturnValue({
					frontmatter: {
						source: 'Granola',
						granola_url: `https://notes.granola.ai/d/${uuid}`,
						created: '2026-08-05T14:30:00Z',
					},
				}),
			};

			// Content parsing alone would find nothing (no frontmatter block)
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue('# Just a body, no frontmatter');

			const cachedDetector = new DuplicateDetector(
				mockVault,
				mockCache as unknown as import('obsidian').MetadataCache
			);
			await cachedDetector.initialize();
			const result = await cachedDetector.checkDocument({ ...mockDocument, id: uuid });

			expect(mockCache.getFileCache).toHaveBeenCalledWith(mockFile);
			expect(result.status).toBe('EXISTS');
		});

		it('should fall back to content parsing when the cache has no entry', async () => {
			const mockFile = createMockFile('uncached.md');
			const mockCache = {
				getFileCache: jest.fn().mockReturnValue(null),
			};
			const content = `---
created: 2026-08-05T14:30:00Z
source: Granola
granola_url: https://notes.granola.ai/d/${uuid}
---

Content.`;

			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([mockFile]);
			(mockVault.read as jest.Mock).mockResolvedValue(content);

			const cachedDetector = new DuplicateDetector(
				mockVault,
				mockCache as unknown as import('obsidian').MetadataCache
			);
			await cachedDetector.initialize();
			const result = await cachedDetector.checkDocument({ ...mockDocument, id: uuid });

			expect(result.status).toBe('EXISTS');
		});
	});

	describe('error handling', () => {
		it('should handle initialization failure', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockImplementation(() => {
				throw new Error('Vault access error');
			});

			await expect(detector.initialize()).rejects.toThrow(
				'Failed to initialize duplicate detector'
			);
		});

		it('should auto-initialize when checking documents before explicit initialization', async () => {
			(mockVault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			// Don't call initialize() explicitly
			const result = await detector.checkDocument(mockDocument);

			expect(result.status).toBe('NEW');
			expect(mockVault.getMarkdownFiles).toHaveBeenCalled();
		});
	});
});
