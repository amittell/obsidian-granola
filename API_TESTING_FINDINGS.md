# Granola API Testing Findings

## Summary

After comprehensive testing of the Granola API endpoints and parameters, we have determined the correct way to fetch document content from the Granola API.

## Key Findings

### ✅ Correct API Usage

**Endpoint:** `POST https://api.granola.ai/v2/get-documents`

**Request Body:**

```json
{
	"limit": 100,
	"offset": 0,
	"include_last_viewed_panel": true
}
```

**Content Location:** `response.docs[].last_viewed_panel.content`

**Content Format:** ProseMirror JSON

### 📊 Content Availability

- **Documents with content:** Not all documents have content in `last_viewed_panel`
- **Documents without content:** Some documents only have empty paragraphs or no content at all
- **Content source priority:**
    1. `last_viewed_panel.content` (Primary - contains actual note content)
    2. `notes.content` (Fallback - usually empty paragraphs)
    3. `notes_markdown` (Fallback - often empty)
    4. `notes_plain` (Final fallback - often empty)

### 🔍 What We Tested

#### 1. Different Parameters on `/v2/get-documents`

- `include_content: true` ❌ No effect
- `include_notes: true` ❌ No effect
- `include_last_viewed_panel: true` ✅ **WORKS**
- `expand: ["content", "notes", "last_viewed_panel"]` ❌ No effect
- `with_content: true` ❌ No effect
- `full: true` ❌ No effect
- `detailed: true` ❌ No effect

#### 2. Individual Document Endpoints

- `GET /v2/documents/{id}` ❌ 404 Not Found
- `GET /v2/document/{id}` ❌ 404 Not Found
- `POST /v2/get-document` ❌ 404 Not Found
- All v1 variants ❌ 404 Not Found

#### 3. Alternative Content Endpoints

- `/v2/notes`, `/v2/content`, `/v2/get-notes`, `/v2/get-content` ❌ All 404 Not Found
- All v1 variants ❌ 404 Not Found

#### 4. API Exploration

- No public API documentation endpoints found
- All exploration endpoints returned 404

## Current Plugin Status

### ✅ Plugin is Already Correctly Implemented

The current plugin code already:

1. Uses the correct API endpoint with `include_last_viewed_panel: true`
2. Prioritizes `last_viewed_panel.content` over other content sources
3. Has proper fallback logic for documents without panel content
4. Converts ProseMirror JSON to Markdown correctly

### 📝 Content Handling

The plugin correctly handles:

- **Documents with content:** Extracts from `last_viewed_panel.content`
- **Documents without content:** Creates placeholder documents with helpful messages
- **Empty documents:** Provides instructions for manual content copying
- **ProseMirror conversion:** Full support for headings, lists, formatting, etc.

## Conclusion

The Granola API does return actual document content, but only when:

1. Using `include_last_viewed_panel: true` in the request
2. Accessing content via `last_viewed_panel.content`
3. The document actually has content saved in Granola

The current Obsidian plugin implementation is **correct and working as expected**. Documents without content in the import are likely empty or haven't been properly saved in Granola.

## Recommendations

1. **Continue using the current implementation** - it's already optimal
2. **Educate users** about why some documents might appear empty
3. **Consider adding a filter** to skip completely empty documents during import
4. **Monitor for API changes** that might provide additional content fields
