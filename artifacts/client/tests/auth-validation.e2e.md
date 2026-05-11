# E2E test plan — sign-up / sign-in inline validation

This plan is run via the Replit testing skill (`runTest`). It complements the
API-level tests in `artifacts/api-server/src/routes/__tests__/auth.test.ts`
and guards the inline-error wiring on `artifacts/client/src/pages/login-page.tsx`.

```
1. [New Context] Create a new browser context
2. [Browser] Navigate to "/"

# A. Non-Scopic email shows inline error under email input
3. [Browser] Click the tab role=tab with text "Create account"
4. [Verify] The "Create account" tab is aria-selected="true" and a "Full Name" label is visible.
5. [Browser] Fill #name with "Test User"
6. [Browser] Fill #email with "alice@example.com"
7. [Browser] Fill #password with "longenough"
8. [Browser] Click the form submit button labeled "Create account" (button[type=submit], NOT the tab)
9. [Verify]
   - "Create account" tab still has aria-selected="true"
   - #email has aria-invalid="true"
   - There is a <p> directly under #email mentioning "scopicsoftware.com"

# B. 3-character password shows inline error under password input
10. [Browser] Clear #email and fill with "alice@scopicsoftware.com"
11. [Browser] Clear #password and fill with "abc"
12. [Browser] Click the form submit button "Create account"
13. [Verify]
    - #password has aria-invalid="true"
    - There is a <p> directly under #password mentioning "6 characters" or "at least 6"
    - #email no longer has aria-invalid="true"

# C. Switching tabs clears errors
14. [Browser] Click the tab role=tab with text "Sign in"
15. [Verify]
    - The "Sign in" tab has aria-selected="true"
    - The top-of-form red banner is GONE
    - #email does not have aria-invalid="true"
    - #password does not have aria-invalid="true"

# D. Existing-account error shows under the email input
16. [Browser] In page.evaluate generate: window.__REG = "dup-" + Math.random().toString(36).slice(2,10) + "@scopicsoftware.com"; return window.__REG. Save as REG_EMAIL.
17. [Browser] Click the tab "Create account"
18. [Browser] Fill #name with "Dup First", #email with REG_EMAIL, #password with "validpass1"
19. [Browser] Click the form submit button "Create account"
20. [Browser] Wait until the URL/UI shows the user is signed in (dashboard chrome visible).
21. [Verify] User is signed in (the LoginPage is no longer visible).
22. [Browser] Sign out: in page.evaluate run: localStorage.removeItem("auth_token"); localStorage.removeItem("auth_user"); location.reload();
23. [Browser] Wait for the login page to render (#email visible).
24. [Browser] Click the tab "Create account"
25. [Browser] Fill #name with "Dup Second", #email with the SAME REG_EMAIL from step 16, #password with "validpass2"
26. [Browser] Click the form submit button "Create account"
27. [Browser] Wait 1500ms for response and re-render.
28. [Verify]
    - The "Create account" tab still has aria-selected="true"
    - #email has aria-invalid="true"
    - There is a <p> directly under #email containing the text "already exists"
    - The top red banner contains the text "already exists"
    - The user is NOT redirected to the dashboard (still on login page)
```

## Notes

- The duplicate-email branch only fires on the server; the other two branches
  are caught client-side first by `validateRegisterClientSide()` in
  `login-page.tsx`, but the rendered inline-error markup is the same either
  way, which is what this plan asserts.
- For the duplicate-email branch to be observable, `App.tsx` must keep
  `LoginPage` mounted across the in-flight register request (i.e. only show
  the full-page spinner when there is a stored token being verified, not
  during form submissions). Otherwise LoginPage unmounts mid-request and its
  local `mode` resets to "login".
