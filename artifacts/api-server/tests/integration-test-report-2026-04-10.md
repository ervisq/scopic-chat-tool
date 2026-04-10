# Chat Integration Test Report — April 10, 2026

All 8 chat tool integrations tested end-to-end via the `/api/chat` endpoint.
Test user: `ervis.q@scopicsoftware.com` (super_admin).

## Pass/Fail Summary

| Integration       | Tool Routed     | Status    | Query Used                                       | Result                                                            |
|-------------------|-----------------|-----------|--------------------------------------------------|-------------------------------------------------------------------|
| STS               | query_sts       | PASS      | "how many hours did I log this week?"             | 2.0 hours total, 1 entry on 2026-04-09 (Business Development)    |
| STS (last week)   | query_sts       | PASS      | "show my hours last week"                         | 0 hours (Mon 2026-03-30 to Sun 2026-04-05), correctly resolved   |
| STS (project)     | query_sts       | PASS      | "hours on Business Development this week?"        | 2.0 hours, project_filter correctly extracted by AI               |
| JIRA              | query_jira      | PASS      | "show my open Jira tickets"                       | 6 tickets returned (KAN-1 through KAN-7) via OAuth               |
| Teamwork          | query_teamwork  | PASS      | "show my Teamwork tasks"                          | 25 tasks returned with project/assignee/priority data             |
| Outlook Mail      | query_outlook    | PASS      | "show my recent emails"                           | 15 emails with subjects, senders, timestamps                     |
| Outlook Calendar  | query_outlook    | PASS      | "what meetings do I have this week?"              | 0 events (valid — no meetings scheduled)                         |
| Outlook Contacts  | query_outlook    | PASS      | "find contact information for Alessandra"         | Found Alessandra Papini (alessandra.p@scopicsoftware.com)        |
| Zoho People       | query_zoho_people | PASS    | "show employee list from Zoho People"             | 1 employee record (Ervis Qose) — role-restricted visibility      |
| Zoho CRM          | query_zoho_crm  | PASS (FIXED) | "show recent leads from Zoho CRM"             | 0 leads (no data in CRM). Fixed v7 API error with v2 fallback.   |
| Zoho Recruit      | query_zoho_recruit | PERM ISSUE | "show open job positions from Zoho Recruit"   | 401/403 — OAuth token lacks Recruit API scope                    |
| Zoho Contracts    | query_zoho_contracts | PERM ISSUE | "show active contracts from Zoho Contracts" | 401/403 — OAuth token lacks Contracts API scope                  |
| General Chat      | (none)          | PASS      | "hello, how are you?"                             | AI responded with greeting, no tool invoked                      |

## Detailed Test Results

### Test 1: STS (This Week)
- **Query**: "how many hours did I log this week?"
- **AI Routing**: `query_sts` with args `{"date_range_start":"2026-04-06","date_range_end":"2026-04-12"}`
- **API Response**: 1 entry, 2.0 hours on 2026-04-09, project "Business Development Operations"
- **Formatted Output**: Daily breakdown (Mon-Sun), project breakdown, detailed entry list
- **Verdict**: PASS

### Test 2: STS (Last Week)
- **Query**: "show my hours last week"
- **AI Routing**: `query_sts` with args `{"date_range_start":"2026-03-30","date_range_end":"2026-04-05"}`
- **API Response**: 0 entries, 0 hours
- **Formatted Output**: "Total: 0 hours" with daily breakdown Mon-Sun
- **Verdict**: PASS — correctly resolved "last week" as previous Mon-Sun

### Test 2b: STS (Project Filter)
- **Query**: "how many hours did I log on Business Development this week?"
- **AI Routing**: `query_sts` with args `{"date_range_start":"2026-04-06","date_range_end":"2026-04-12","project_filter":"Business Development"}`
- **Server Log**: `[STS] Using structured params — date range: 2026-04-06 to 2026-04-12 project: Business Development`
- **API Response**: 1 entry, 2.0 hours on 2026-04-09 (Business Development Operations)
- **Formatted Output**: Daily breakdown with project name and task description
- **Verdict**: PASS — AI correctly extracted `project_filter` parameter

### Test 3: JIRA
- **Query**: "show my open Jira tickets"
- **AI Routing**: `query_jira` with args `{"query":"show my open Jira tickets","assignee":"me","status":"open"}`
- **API Response**: 6 tickets (KAN-1 through KAN-7) via OAuth
- **Formatted Output**: Ticket ID, title, status, assignee, priority for each
- **Verdict**: PASS

### Test 4: Teamwork
- **Query**: "show my Teamwork tasks"
- **AI Routing**: `query_teamwork` with args `{"query":"show my tasks","category":"tasks"}`
- **API Response**: 25 tasks with full metadata
- **Formatted Output**: Task names, requesters, priorities, due dates
- **Verdict**: PASS

### Test 5a: Outlook Mail
- **Query**: "show my recent emails"
- **AI Routing**: `query_outlook` with args `{"query":"recent emails","category":"mail"}`
- **API Response**: 15 emails via Microsoft Graph API
- **Formatted Output**: Subject, sender, date, preview for each email
- **Verdict**: PASS

### Test 5b: Outlook Calendar
- **Query**: "what meetings do I have this week?"
- **AI Routing**: `query_outlook` with args `{"query":"meetings","category":"calendar"}`
- **API Response**: 0 events in the week range
- **Formatted Output**: "No meetings scheduled for this week"
- **Verdict**: PASS (valid — no meetings exist)

### Test 5c: Outlook Contacts
- **Query**: "find contact information for Alessandra"
- **AI Routing**: `query_outlook` with args `{"query":"Alessandra","category":"contacts"}`
- **API Response**: Contact data from email directory
- **Formatted Output**: Name and email for Alessandra Papini
- **Verdict**: PASS

### Test 6: Zoho People
- **Query**: "show employee list from Zoho People"
- **AI Routing**: `query_zoho_people` with args `{"query":"show employee list"}`
- **API Response**: 1 employee record (Ervis Qose, Senior Designer, Design dept)
- **Note**: Only 1 record returned due to Zoho People role restrictions. Alternate fetch methods tried (v3, P_EmployeeView, P_Employee) — all confirmed single record. This is a Zoho account permission limitation, not a code issue.
- **Verdict**: PASS (limited by Zoho role permissions)

### Test 7: Zoho CRM (FIXED)
- **Query**: "show recent leads from Zoho CRM"
- **AI Routing**: `query_zoho_crm` with args `{"query":"show recent leads","module":"leads"}`
- **Initial Error**: v7 API returned 400: `{"code":"REQUIRED_PARAM_MISSING","details":{"param_name":"fields"}}`
- **Fix Applied**: Added v2 fallback in `fetchModule()` and `searchModule()`. Also added `ZohoPermissionError` for 401/403.
- **After Fix**: v2 API returns 0 leads (no CRM data exists but the API call succeeds)
- **Verdict**: PASS after fix

### Test 8: Zoho Recruit (Permission Issue)
- **Query**: "show open job positions from Zoho Recruit"
- **AI Routing**: `query_zoho_recruit` with args `{"query":"open job positions"}`
- **Error**: 401/403 — OAuth token does not include ZohoRecruit.modules.ALL scope
- **Error Handler Chain**: `zohoRecruitService` throws `ZohoPermissionError` → caught by `queryZohoRecruitDirect()` in `zohoService.ts` via `isPermissionError()` → calls `handlePermissionError("Recruit", ...)` → clears token cache → returns user-facing error
- **User Message**: "Zoho Recruit access denied — your Zoho connection needs updated permissions. Please go to Connected Services, click 'Update' on the Zoho card, then click 'Reconnect' to grant Recruit access."
- **Verdict**: PERMISSION ISSUE — error handling works correctly, user gets clear actionable instructions

### Test 9: Zoho Contracts (Permission Issue)
- **Query**: "show active contracts from Zoho Contracts"
- **AI Routing**: `query_zoho_contracts` with args `{"query":"active contracts"}`
- **Error**: 401/403 — OAuth token does not include ZohoContracts scope
- **Error Handler Chain**: Same as Recruit — `ZohoPermissionError` → `isPermissionError()` → `handlePermissionError("Contracts", ...)` → clears token cache → returns user-facing error
- **User Message**: "Zoho Contracts access denied — your Zoho connection needs updated permissions. Please go to Connected Services, click 'Update' on the Zoho card, then click 'Reconnect' to grant Contracts access."
- **Verdict**: PERMISSION ISSUE — error handling works correctly, user gets clear actionable instructions

### Test 10: General Chat (No Tool)
- **Query**: "hello, how are you?"
- **AI Routing**: No tool called (general conversation)
- **Response**: AI greeted the user naturally
- **Verdict**: PASS

## Code Fix: Zoho CRM v7 to v2 Fallback

**File**: `artifacts/api-server/src/services/zohoCrmService.ts`

**Root Cause**: Zoho CRM API v7 requires a mandatory `fields` parameter that was not being sent. The API returned:
```json
{"code":"REQUIRED_PARAM_MISSING","details":{"param_name":"fields"},"message":"One of the expected parameter is missing","status":"error"}
```

**Fix**: 
1. `fetchModule()` now catches 400 errors from v7 and retries with v2 endpoint
2. `searchModule()` now tries v7, falls back to v2, and propagates 401/403 as `ZohoPermissionError`
3. Both functions now handle 401/403 as `ZohoPermissionError` instead of generic errors

## Open Items / Follow-Up

| Item | Owner | Action Required | Status |
|------|-------|-----------------|--------|
| Zoho Recruit scope | Admin (Zoho account owner) | Re-authorize Zoho OAuth to include `ZohoRecruit.modules.ALL` scope | Pending |
| Zoho Contracts scope | Admin (Zoho account owner) | Re-authorize Zoho OAuth to include `ZohoContracts.modules.ALL` scope | Pending |

These are external configuration issues, not code defects. The error handling code correctly detects the permission denial, clears the cached token, and returns a user-facing message with specific reconnection instructions.
