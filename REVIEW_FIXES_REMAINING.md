# Obsidian Review Fixes - Remaining Work

## ✅ COMPLETED (In this branch)

1. **Remove custom sleep() function** - Now using `window.sleep()` from Obsidian API
2. **Replace custom htmlToMarkdown()** - Now using `htmlToMarkdown()` from Obsidian API
3. **Replace manual YAML construction** - Now using `stringifyYaml()` from Obsidian API
4. **Settings headings** - Already using `Setting().setHeading()` (done in previous PR)
5. **Manifest description** - Already fixed (no "Obsidian")
6. **Manifest fundingUrl** - Already removed

## ❌ STILL TODO (High Priority)

### 1. Sentence Case in UI Text

**Files to update:**

- `main.ts` - Command names (lines 149, 158, 169)
- `settings.ts` - Button text (lines 54, 267)
- `ui/document-selection-modal.ts` - Status labels (lines 208-212), section headers (932, 978)
- `ui/conflict-resolution-modal.ts` - Modal titles, button text, section headers (multiple locations)

**Changes needed:**

- "Import Granola Notes (Selective)" → "Import Granola notes (selective)"
- "Diagnose Empty Granola Documents" → "Diagnose empty Granola documents"
- "Debug Granola API Response" → "Debug Granola API response"
- "Test Connection" → "Test connection"
- "Preview" → keep as-is (single word)
- "Replace File" → "Replace file"
- "Append Granola Content" → "Append Granola content"
- "Prepend Granola Content" → "Prepend Granola content"
- "Import with New Name" → "Import with new name"
- And many more throughout the modals...

### 2. Remove Ribbon Icon Toggle Setting

**Why:** Obsidian v1.1.0+ has built-in ribbon customization

**Files to update:**

- `src/types.ts` (line 108) - Remove `showRibbonIcon: boolean;`
- `main.ts` (line 621) - Remove conditional `if (this.settings.ui.showRibbonIcon)`
- `src/settings.ts` (lines 361-370) - Remove ribbon icon toggle setting

**Action:** Always add ribbon icon, let users hide it via Obsidian's native interface

### 3. Move Inline Styles to styles.css

**Files affected:**

- `src/ui/document-selection-modal.ts` - `applyStyles()` method (lines 1499-1983)
- `src/ui/conflict-resolution-modal.ts` - `applyStyles()` method (lines 554-722)

**Action:**

- Extract all CSS from these methods
- Add to `styles.css`
- Remove `applyStyles()` methods entirely
- Update class names to match

### 4. Deduplicate decodeHtmlEntities()

**Current locations:**

- `src/converter.ts` (implementation)
- `src/services/duplicate-detector.ts` (duplicate)
- `src/services/document-metadata.ts` (may use it)
- `src/utils/html.ts` (may have another copy)

**Action:**

- Keep ONE implementation in a utils file
- Import and use that single version everywhere

### 5. Node.js Imports in auth.ts (Lower priority - desktop only)

**File:** `src/auth.ts` (lines 1-3)

**Current:** Uses `fs/promises`, `path`, `os` from Node.js

**Note:** Plugin manifest has `"isDesktopOnly": true` so this MAY be acceptable, but reviewer flagged it. If needed to fix:

- Use Obsidian's DataAdapter API instead
- Or add explicit comment explaining desktop-only requirement

### 6. Modal Headings (h2/h3/h4) - Clarification Needed

**Reviewer flagged these but they're in MODALS, not settings:**

- `ui/document-selection-modal.ts` - h4 elements (lines 932, 978)
- `ui/conflict-resolution-modal.ts` - h2, h3, h4 elements (lines 101, 161, 195, 218, 337, 373)

**Question:** Are these acceptable in modals? Settings tab headings were the main issue.
**Safe approach:** Convert these to styled div elements with appropriate classes

## 📋 TESTING CHECKLIST

After all fixes:

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Manual test: Settings UI renders correctly
- [ ] Manual test: Import modal works
- [ ] Manual test: Conflict modal works
- [ ] Manual test: All buttons use sentence case
- [ ] Manual test: Styles applied correctly from CSS file

## 🔄 ESTIMATED WORK

- **Sentence case fixes:** 30-40 occurrences across 4 files (~1-2 hours)
- **Ribbon icon removal:** 3 locations (~15 minutes)
- **Style extraction:** Large but mechanical (~2-3 hours)
- **Deduplication:** ~30 minutes
- **Modal headings:** ~30 minutes if needed

**Total estimated:** 5-7 hours of focused work
