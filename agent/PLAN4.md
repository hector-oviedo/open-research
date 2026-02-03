# PLAN 4: Sources Fix & Documentation Update 🔧

**Status:** ✅ COMPLETE

**Goal:** Fix sources display issue and ensure sources are visible as bullet points with clickable link icons throughout the research process.

---

## Problem Analysis

### Issue 1: Missing Source Fields
The `Source` interface in frontend requires `id`, `url`, `title`, `domain`, `reliability`, `confidence`.
But `_extract_sources_from_findings()` in `writer.py` only returns:
- `url`
- `title`  
- `reliability`

**Missing:** `id`, `domain`, `confidence`

### Issue 2: Property Name Mismatch
- Backend sends: `sources_used` (snake_case)
- Frontend expects: `sourcesUsed` (camelCase)

The SSE event passes `final_report` directly without transformation.

### Issue 3: No Link Icons in Event Log
User wants to see clickable link icons next to sources in the event log as they are discovered.

---

## Implementation Plan

### Step 1: Fix Backend Source Extraction ✅
**File:** `backend/app/agents/writer.py`

Update `_extract_sources_from_findings()` to include:
- `id`: Generate from URL hash or index
- `domain`: Extract from URL
- `confidence`: Include from metadata

### Step 2: Fix Frontend Type Handling ✅
**File:** `frontend/src/types/index.ts`

Make `sourcesUsed` compatible with backend format or add transformation layer.

### Step 3: Add SourceLink Component ✅
**File:** `frontend/src/components/SourceLink.tsx` (NEW)

Create a reusable component that:
- Shows link icon
- Shows domain name
- Is clickable to open source
- Shows tooltip on hover

### Step 4: Update TraceLog for Source Links ✅
**File:** `frontend/src/components/TraceLog.tsx`

Display source links when finder discovers sources with clickable icons.

### Step 5: Verify Source Display in Report ✅
**File:** `frontend/src/components/ReportViewer.tsx`

Ensure sources appear as bullet list with proper formatting.

### Step 6: Update Documentation ✅
**File:** `README.md`

Verify:
- All file names are correct
- Folder structure is accurate
- Add PLAN4 to tracked plans

### Step 7: Git Commit ✅

---

## Success Criteria

- [x] Sources show as bullet list in final report
- [x] Each source has clickable link icon
- [x] Source cards show: favicon, title, domain, reliability badge
- [x] During finder phase, sources appear in TraceLog with links
- [x] README.md is accurate and up-to-date
- [x] PLAN4.md created and tracked

---

## Commits Made

1. `fix(sources): add id, domain, confidence to sources_used extraction`
2. `feat(ui): add SourceLink component for clickable source icons`
3. `feat(ui): display source links in TraceLog during finder phase`
4. `docs(readme): verify file names and update structure`

---

## Commits

1. `fix(sources): add id, domain, confidence to sources_used extraction`
2. `feat(ui): add SourceLink component for clickable source icons`
3. `feat(ui): display source links in TraceLog during finder phase`
4. `docs(readme): verify file names and update structure`
5. `docs(plan): add PLAN4 for sources fix`
