# Granola Importer Debug Tools

This directory contains debugging tools to analyze and resolve two critical issues with the Obsidian Granola importer:

1. **Duplicate filenames for recurring meetings** - Investigate date-prefixed filename functionality
2. **Missing note content** - Debug why only headers import while note bodies remain empty

## Quick Start

### 1. Test with Mock Data (Offline)

Test the conversion logic with known test cases:

```bash
node test-conversion.js
```

This will:
- Test ProseMirror to Markdown conversion
- Validate date-prefixed filename generation
- Check content fallback logic
- Generate test output files for inspection

### 2. Inspect Real API Response

Analyze the actual structure of Granola API responses:

```bash
export GRANOLA_TOKEN="your-granola-token-here"
node inspect-api-response.js
```

This will:
- Fetch a small sample from your Granola account
- Analyze response structure vs expected interface
- Check content field availability and format
- Generate `api-response-analysis.json` for detailed inspection

### 3. Full End-to-End Debug

Test the complete import pipeline with real data:

```bash
export GRANOLA_TOKEN="your-granola-token-here"
node debug-granola-issues.js
```

This will:
- Fetch documents from Granola API
- Process them through the conversion pipeline
- Generate debug output files
- Provide detailed logging of each step

## Files Overview

### Debug Scripts

- **`debug-granola-issues.js`** - Main debug script testing full pipeline with real API data
- **`test-conversion.js`** - Offline test suite for conversion logic with mock data
- **`inspect-api-response.js`** - API response structure analyzer

### Test Data

- **`test-prosemirror-data.json`** - Mock Granola documents for testing various scenarios:
  - Valid ProseMirror content
  - Empty documents
  - Corrupted/invalid structures
  - Fallback scenarios
  - Complex formatting examples

### Generated Output Files

After running the scripts, you'll find:
- **`debug-output-*.md`** - Converted documents from real API data
- **`test-output-*.md`** - Converted documents from test data
- **`api-response-analysis.json`** - Detailed API response structure analysis

## Analysis Results

### Issue 1: Date-Prefixed Filenames

**Status**: ✅ **Likely Working Correctly**

The implementation in `/src/converter.ts` appears correct:
- `generateDatePrefixedFilename()` method properly formats dates as "YYYY-MM-DD - Title"
- Called by `convertDocument()` on line 160
- Includes proper sanitization and error handling

**Possible causes if still not working**:
- User running old version of plugin
- Edge case with invalid/missing dates
- Timezone conversion issues

### Issue 2: Missing Note Content

**Status**: 🔍 **Requires Investigation**

The content conversion has a robust 3-tier fallback system:
1. ProseMirror JSON conversion (primary)
2. `notes_markdown` field (fallback 1)
3. `notes_plain` field (fallback 2)

**Most likely root causes**:
1. **API Response Issues**:
   - Content fields (`notes`, `notes_plain`, `notes_markdown`) are null/empty in API response
   - API response structure changed from expected interface
   
2. **ProseMirror Validation Issues**:
   - `isValidProseMirrorDoc()` validation too strict
   - New ProseMirror node types not handled
   - Empty content nodes not detected properly

3. **Conversion Pipeline Issues**:
   - `convertProseMirrorToMarkdown()` failing silently
   - Node conversion logic missing cases
   - Text extraction not working for new formats

## Debugging Workflow

1. **Start with API inspection**:
   ```bash
   node inspect-api-response.js
   ```
   Check if content fields are populated in the API response.

2. **Test conversion logic**:
   ```bash
   node test-conversion.js
   ```
   Verify that the conversion logic works with known good data.

3. **Full pipeline test**:
   ```bash
   node debug-granola-issues.js
   ```
   Test with real API data to identify where the pipeline breaks.

4. **Analyze output files**:
   - Check `debug-output-*.md` files for actual imported content
   - Compare with expected content from API response
   - Look for patterns in failed conversions

## Expected Findings

Based on code analysis, the most likely discoveries will be:

1. **Date-prefixed filenames are working** - This feature was already implemented correctly
2. **Content is empty in API response** - Granola documents may not have content in the expected fields
3. **ProseMirror structure mismatch** - API may be returning different node structures than expected
4. **Validation logic too strict** - `isValidProseMirrorDoc()` may be rejecting valid but differently-structured content

## Next Steps After Debugging

Once you identify the root cause:

1. **If API response is empty**: Check Granola account, document selection, or API permissions
2. **If ProseMirror structure changed**: Update type definitions and conversion logic
3. **If validation too strict**: Relax validation rules or add new cases
4. **If conversion logic fails**: Add missing node types or improve text extraction

## Support

If debugging reveals unexpected issues not covered here, check:
- Recent Granola API updates or changes
- Document types being imported (new vs old documents)
- Network/authentication issues
- Obsidian plugin compatibility