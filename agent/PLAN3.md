# PLAN 3: Deep Fixes & Enhancements 🔧

**Status:** New feedback requiring focused deep work

**Approach:** Style issues first (quick wins), then architectural improvements

---

## Chunk 1: UI/Style Fixes (Start Here)

### Step 1.1: AgentStatus Animation Line Fix
- **Issue:** Agent boxes have rounded bottom corners, breaking animation line continuity
- **Fix:** Remove rounded bottom corners (`rounded-b-none`) from agent boxes
- **Change:** Progress animation from "fill to 100%" to "processing loop" (indeterminate)
- **Files:** `frontend/src/components/AgentStatus.tsx`

**Validation:** Check that animation line connects perfectly between agent boxes, and shows a looping "processing" effect instead of fill-to-100%

---

### Step 1.2: Research Progress Animation Fix
- **Issue:** Progress bar cycles but doesn't reach 100% properly
- **Fix:** Fix the animation to properly cycle and show progress
- **Files:** `frontend/src/components/ProgressTracker.tsx` or related

**Validation:** Progress bar should show smooth cycling animation that indicates processing

---

### Step 1.3: Markdown Rendering for Reports
- **Issue:** Results look like plain markdown with no formatting
- **Fix:** Integrate a markdown styling library (react-markdown + remark-gfm or similar)
- **Files:** `frontend/src/components/ReportViewer.tsx`
- **Add:** Proper styling for headers, lists, code blocks, links, etc.

**Validation:** Report should render with proper typography, spacing, and styling

---

## Chunk 2: Backend Streaming & Resilience

### Step 2.1: Finder Links Streaming
- **Issue:** All finder links appear at once instead of streaming as found
- **Fix:** Emit events for each source as it's discovered, not batch at end
- **Files:** 
  - `backend/app/core/graph.py` - `_finder_node()` method
  - `backend/app/agents/finder.py` - may need to yield instead of return
- **Frontend:** `frontend/src/components/TraceLog.tsx` - handle streaming sources

**Validation:** As finder discovers sources, they should appear one-by-one in the event log

---

### Step 2.2: Summarizer Fallback (0 Key Facts)
- **Issue:** Summarizer sometimes gets 0 extracted key facts (finder may have failed)
- **Fix:** Implement retry/fallback logic - if summarizer gets 0 facts, reactivate finder with extended search
- **Approach:**
  - Check findings count in summarizer node
  - If 0, emit `finder_retry` event and loop back to finder with broader query
  - Add retry counter to prevent infinite loops
- **Files:** 
  - `backend/app/core/graph.py` - add conditional edge logic
  - `backend/app/agents/summarizer.py` - detect empty findings

**Validation:** When finder returns no sources, system should retry with modified query

---

## Chunk 3: Quality & Accuracy

### Step 3.1: Review and Improve Prompts
- **Task:** Review all agent prompts for clarity and effectiveness
- **Files:** `backend/app/agents/prompts/*.md`
- **Focus Areas:**
  - Planner: Ensure sub-questions are specific and diverse
  - Finder: Improve search query generation
  - Summarizer: Better extraction instructions
  - Reviewer: Clearer gap detection criteria
  - Writer: Better citation format instructions

**Validation:** Run test queries and verify output quality improved

---

### Step 3.2: Fix Citations / Sources Mismatch
- **Issue:** Report shows citations like [1][4][5][7] but "no sources available" at bottom
- **Investigation:** 
  - Check if Writer is hallucinating citations
  - Or if sources aren't being passed through properly
  - Verify source ID mapping between finder and writer
- **Files:**
  - `backend/app/agents/writer.py` - check citation generation
  - `backend/app/core/graph.py` - verify sources in state
  - `frontend/src/components/ReportViewer.tsx` - verify sources display

**Validation:** Citations should map to actual sources, no hallucination

---

## Chunk 4: Documentation & Wrap-up

### Step 4.1: README.md Review & Update
- **Task:** Review all changes made in PLAN3 and update README.md
- **Focus:**
  - Update any changed behaviors
  - Document new streaming features
  - Document retry logic
  - Update troubleshooting section if needed

**Validation:** README accurately reflects current system behavior

---

### Step 4.2: Git Commit
- **Task:** Commit all PLAN3 changes
- **Message:** `feat: implement PLAN3 enhancements - streaming, resilience, markdown rendering`

---

## Execution Order

```
Chunk 1 (UI/Style):
  → Step 1.1: AgentStatus line fix
  → Step 1.2: Progress animation fix
  → Step 1.3: Markdown rendering

Chunk 2 (Backend Streaming):
  → Step 2.1: Finder links streaming
  → Step 2.2: Summarizer fallback

Chunk 3 (Quality):
  → Step 3.1: Prompt improvements
  → Step 3.2: Citations fix

Chunk 4 (Wrap-up):
  → Step 4.1: README review
  → Step 4.2: Git commit
```

---

## Success Criteria

- [ ] AgentStatus animation line looks perfect (no rounded gaps)
- [ ] Progress bar shows proper "processing" loop animation
- [ ] Reports render with beautiful markdown styling
- [ ] Finder links stream one-by-one as discovered
- [ ] System recovers when finder returns 0 sources (retry logic)
- [ ] Prompts are improved and produce better results
- [ ] Citations match actual sources (no hallucination)
- [ ] README updated with all changes
- [ ] All changes committed

---

## Notes

- **STOP** after each step and ask for validation
- **TEST** each fix individually before moving to next
- **DOCUMENT** any unexpected findings in MEMORY.md
