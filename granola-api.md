# Granola API Documentation

This document contains technical details about the Granola API for developers who want to understand how the plugin integrates with Granola's services.

## API Configuration

### Base URL

`https://api.granola.ai/v2`

### Primary Endpoint

`/get-documents` (POST)

### Authentication

Bearer token from Cognito

### Required Headers

```
Authorization: Bearer {access_token}
Content-Type: application/json
User-Agent: Granola/5.354.0
X-Client-Version: 5.354.0
```

## Credential Storage

### File Location by Platform

- **macOS**: `~/Library/Application Support/Granola/supabase.json`
- **Windows**: `%APPDATA%/Granola/supabase.json`
- **Linux**: `~/.config/Granola/supabase.json`

### Configuration Structure

```json
{
  "cognito_tokens": "{\"access_token\":\"...\",\"token_type\":\"Bearer\",\"expires_in\":3600,\"refresh_token\":\"...\",\"id_token\":\"...\"}",
  "user_info": "{\"id\":\"...\",\"email\":\"...\"}"
}
```

## API Request Payload

**Critical Parameter**: Must include `include_last_viewed_panel: true` to retrieve note content.

```json
{
  "limit": 100,
  "offset": 0,
  "include_last_viewed_panel": true
}
```

## Content Location and Structure

### Primary Content Location

`response.docs[].last_viewed_panel.content`

### Content Format

ProseMirror JSON document structure

### Fallback Fields

- `notes.content` (ProseMirror JSON)
- `notes_markdown` (plain markdown)
- `notes_plain` (plain text)

### Document Metadata

- `id`: Unique document identifier
- `title`: Document title
- `created_at`: ISO timestamp
- `updated_at`: ISO timestamp
- `user_id`: Owner identifier

## ProseMirror Content Structure

### Document Root

```json
{
  "type": "doc",
  "content": [...]
}
```

### Node Types

- `paragraph`: Text paragraphs with inline formatting
- `heading`: Headers with level attribute (1-6)
- `bulletList`: Unordered lists
- `orderedList`: Numbered lists
- `listItem`: Individual list items
- `text`: Raw text nodes with optional marks
- `hardBreak`: Line breaks
- `codeBlock`: Code blocks with language attribute
- `blockquote`: Quote blocks
- `table`: Table structures
- `horizontalRule`: Horizontal dividers

### Text Formatting Marks

- `strong`: Bold text (**text**)
- `em`: Italic text (_text_)
- `code`: Inline code (`text`)
- `link`: Hyperlinks with href attribute

## Content Extraction Priority

1. **Primary**: `last_viewed_panel.content` (requires `include_last_viewed_panel: true`)
2. **Fallback 1**: `notes.content` (legacy ProseMirror)
3. **Fallback 2**: `notes_markdown` (pre-converted markdown)
4. **Fallback 3**: `notes_plain` (plain text)

## API Response Validation

### Required Fields for Valid Document

- `type: "doc"`
- `content: Array` (non-empty)
- Valid ProseMirror node structure

### Error Conditions

- Missing `include_last_viewed_panel` parameter results in empty content
- Malformed ProseMirror structure indicates API changes
- Empty content arrays suggest document sync issues

## Security Considerations

- **No credential storage**: Plugin reads credentials directly from Granola's secure storage
- **No token logging**: Credentials never appear in console or logs
- **Secure error handling**: Error messages don't expose sensitive data
- **Platform-specific paths**: Automatic detection across operating systems

## Rate Limiting

The API client implements exponential backoff for rate limiting:

- Batch processing with 100 documents per request
- Retry logic for 429 responses
- Network failure handling
