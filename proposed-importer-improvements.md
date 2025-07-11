# Proposed Granola Importer Improvements

Based on the investigation into document relationships and duplicate patterns, here are recommended improvements:

## 1. Empty Document Filtering

Add option to filter out empty placeholder documents:

```javascript
// In document selection modal or import manager
const filterEmptyDocuments = documents => {
	return documents.filter(doc => {
		// Skip documents that were never modified after creation
		if (doc.created_at === doc.updated_at) {
			return false;
		}

		// Skip documents with no meaningful content
		const hasContent =
			doc.last_viewed_panel?.content ||
			doc.notes_plain ||
			doc.notes_markdown ||
			doc.notes?.content?.length > 1 ||
			doc.notes?.content?.[0]?.content?.length > 0;

		return hasContent;
	});
};
```

## 2. Duplicate Document Detection

Group documents by title to detect duplicates:

```javascript
const groupDocumentsByTitle = documents => {
	const groups = {};

	documents.forEach(doc => {
		if (!groups[doc.title]) {
			groups[doc.title] = [];
		}
		groups[doc.title].push(doc);
	});

	return groups;
};

const selectPrimaryDocument = duplicates => {
	// Sort by: has content, then by most recent update
	return duplicates.sort((a, b) => {
		const aHasContent = a.last_viewed_panel?.content || a.notes_plain;
		const bHasContent = b.last_viewed_panel?.content || b.notes_plain;

		if (aHasContent && !bHasContent) return -1;
		if (!aHasContent && bHasContent) return 1;

		return new Date(b.updated_at) - new Date(a.updated_at);
	})[0];
};
```

## 3. User Interface Improvements

### Document Selection Modal

- Show duplicate indicators
- Allow filtering empty documents
- Group related documents visually

### Progress Reporting

- Distinguish between "empty document skipped" vs "import failed"
- Show duplicate document handling in progress

## 4. Configuration Options

Add settings for duplicate handling:

```javascript
const importSettings = {
	duplicateHandling: 'latest', // 'latest', 'all', 'ask'
	skipEmptyDocuments: true,
	skipUnmodifiedDocuments: true,
	groupDuplicatesByTitle: true,
};
```

## 5. Enhanced Logging

Improve debug messages for duplicate detection:

```javascript
// Example improved logging
console.log('[Duplicate Detector] Found document group:', {
	title: doc.title,
	count: duplicates.length,
	primarySelected: primaryDoc.id,
	skippedEmpty: emptyDocs.length,
	reason: 'calendar_rescheduling',
});
```

## 6. Metadata Preservation

For users who want to preserve the relationship information:

```javascript
// Add metadata to YAML frontmatter
const metadata = {
	granola_id: doc.id,
	related_documents: duplicates.map(d => d.id),
	original_meeting_date: earliestDoc.created_at,
	actual_meeting_date: latestDoc.created_at,
	calendar_event_id: doc.google_calendar_event?.id,
};
```

## Implementation Priority

1. **High Priority**: Empty document filtering (immediate user benefit)
2. **Medium Priority**: Duplicate detection and primary selection
3. **Low Priority**: Advanced metadata preservation and relationship tracking

## Benefits

- **Cleaner imports**: No more empty placeholder files
- **Better user experience**: Clear feedback about duplicates
- **Reduced confusion**: Users understand why some documents are skipped
- **Flexible handling**: Users can choose how to handle duplicates

## Backward Compatibility

These improvements should be:

- **Optional**: Controlled by user settings
- **Non-breaking**: Existing behavior preserved by default
- **Transparent**: Clear logging about what's being filtered/grouped
