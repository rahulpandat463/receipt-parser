# Receipt Parser

## What did you build?

A full-stack web app that accepts a photo of a receipt (JPG/PNG), sends it to Claude's vision API, and returns structured data — merchant name, date, individual line items, tax, tip, and total. The user reviews the extracted fields in an inline editor, makes corrections, and saves the result to a local SQLite database. Saved receipts can be viewed, re-edited, or deleted from a history list.

---

## Setup

**Requirements:** Node 18+, an Anthropic API key.

```bash
# 1. Clone and enter the repo
git clone <repo-url> && cd receipt-parser

# 2. Add your API key
cp backend/.env.example backend/.env
# Edit backend/.env and set ANTHROPIC_API_KEY=...

# 3. Start everything
npm run dev
```

The app will be at **http://localhost:5173**. The backend runs on port 3001.

**Environment variables** (in `backend/.env`):

| Variable           | Required | Default                   | Description                        |
|--------------------|----------|---------------------------|------------------------------------|
| `ANTHROPIC_API_KEY`| ✅       | —                         | Your Anthropic API key             |
| `PORT`             | No       | `3001`                    | Backend port                       |
| `FRONTEND_ORIGIN`  | No       | `http://localhost:5173`   | CORS origin for the frontend       |

---

## The five questions

### 1. What did you build?

*(See above — I've kept this section at the top for skimmability.)*

### 2. What are the biggest tradeoffs you made, and why?

**Line item definition — purchased items only, no totalling rows.**
Receipts contain a mess of subtotals, taxes, discounts, loyalty deductions, and "rounding" lines. I made a deliberate call: `lineItems` contains only the things a customer actually bought (or the services rendered). Tax and tip go in their own dedicated fields; subtotal is stored separately but not surfaced prominently. The rationale is that line items are *what you bought*, not *how the math works*. A downstream expense-reporting tool cares about SKU-level items, not the tax line — that's already computed. I reinforce this in the system prompt with an explicit exclusion rule, and I surface a "computed total vs. receipt total" mismatch warning in the UI so the user can spot when the LLM accidentally included tax as a line item.

**Fail-open on parse errors, don't block the save.**
When the LLM returns malformed JSON or fails schema validation, the backend returns a 422 with a blank template rather than a hard 500. The frontend surfaces a warning banner but lets the user fill in fields manually and still save. The alternative — blocking saves on bad parses — would make the app useless on blurry receipts, which are common. The user's time correcting is cheaper than losing the receipt entirely. I do *not* auto-retry: one LLM call per upload keeps latency and cost predictable. If the image is genuinely unreadable, a second call won't help.

**No streaming, no chunked response.**
The parse endpoint is a single blocking call. For a receipt image this completes in 2–5 seconds, which is acceptable. Streaming would add frontend complexity for marginal UX gain — the spinner is enough. If receipts were multi-page PDFs this tradeoff would flip.

### 3. Where did you use an LLM, and for what?

- **Claude (claude-opus-4-5, vision)** — the core parse step. The model receives the image as base64 and a system prompt that specifies the exact JSON schema, the line-item exclusion rules, the confidence scale, and the format for notes. I chose Opus over Sonnet because receipt OCR on real-world photos (faded ink, tilted angles, crinkled paper) benefits from the stronger vision capability; the cost delta per receipt is cents.
- **Claude (this conversation)** — prompt iteration and figuring out edge cases in the system prompt (e.g., how to handle negative discount line items, what "date unreadable" should return vs. null).
- **I wrote the API layer, DB schema, and correction UX myself.** The structure of the correction flow — confidence badges, mismatch warnings, the inline add/remove for line items — came from thinking about what would actually catch LLM errors rather than from generated code.

### 4. What would you do with another week?

In priority order:

1. **Confidence at the field level, not just the receipt level.** Right now the model returns one `"confidence": "low" | "medium" | "high"` for the whole receipt. A blurry total but clear merchant name still gets flagged as `low`, making the banner noise. The better design is per-field confidence, so only the uncertain cells are highlighted — the model can already reason about this, the schema just doesn't expose it yet.

2. **Multi-page / multi-receipt support.** Users often photograph long grocery receipts in two shots, or have a restaurant receipt plus a separate tip slip. Merging these into one record before the parse step would eliminate a common error class.

3. **Export (CSV / JSON).** Saved receipts are useful only insofar as they can leave the app. A one-click CSV download that maps to a standard expense report format (date, merchant, amount, category) is the obvious next step.

4. **Smarter retry on low-confidence.** Today we fail-open. A better fallback for `"confidence": "low"` is to ask the model a second time with a crop of just the total area, which is usually the most important field to get right.

5. **Test coverage for the parser contract.** I have zero tests right now. The highest-value test is a fixture set of known receipt images with known ground-truth extractions — this would catch prompt regressions when the model is updated.

### 5. What's one thing in this spec you'd push back on if I were your PM?

**The spec treats "save the corrected version" as a simple overwrite, but it throws away information.**

Once a user corrects the LLM's output and saves, the original extracted values are gone. That means we can never measure LLM accuracy, identify which receipt formats reliably fail, or notice that a prompt change made things worse. For a product that's supposed to get better over time — which this clearly is — that's a significant loss.

I'd push for storing both the raw LLM extraction and the human-corrected version in separate columns from day one. The storage cost is negligible (it's JSON in SQLite). The benefit is a growing labeled dataset that can drive prompt improvements, fine-tuning, or at minimum a "correction rate" dashboard metric. The schema change is a one-liner now; retrofitting it after you have 10,000 receipts is a migration with data loss risk.

This is the kind of thing that feels like a detail but determines whether the product learns. I'd want to make that call explicitly, not by accident.
