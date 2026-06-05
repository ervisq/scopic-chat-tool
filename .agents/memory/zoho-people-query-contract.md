---
name: queryZohoPeople routing contract
description: queryZohoPeople ignores its first `query` arg; intent must come from subIntent/period.
---

# queryZohoPeople routing contract

`queryZohoPeople(query, clientId, clientSecret, refreshToken, domain?, employee?, subIntent?, period?)`
in `artifacts/api-server/src/services/zohoPeopleService.ts` **ignores the natural-language
`query` string** (`void query;`). Routing is decided entirely by `subIntent` (a
`PeopleSubIntent`) and `period`. With no `subIntent` and no `employee`, it falls back to
`"directory"` (full employee list).

**Why:** tool selection was moved to the LLM router. The chat flow gets `subIntent`/`period`
from the model and passes them in. But any *direct, non-chat* caller (e.g. the dashboard cards
in `routes/dashboard.ts`) must pass `subIntent`/`period` explicitly — passing a semantic string
like `"headcount"` or `"who is on leave today"` as `query` does nothing and silently returns the
directory.

**How to apply:** when calling `queryZohoPeople` outside the LLM path, set `subIntent` (and
`period` where relevant): headcount → `"headcount"`, who's-off-today → `"leave_today"`,
new joiners → `"new_joiners"` + period `"this_month"`. Result shapes differ per intent
(`.total`, `.leaveRequests`, `.employees`).
