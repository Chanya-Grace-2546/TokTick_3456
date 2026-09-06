# AI Use — Lab 2 (TokTickIT)

## LLM Used
Claude (Anthropic), used throughout Lab 2 for specification drafting, test
planning, implementation, and completion review across all six Issues.

## Key Prompts and Reflections

| Prompt Name | Example Prompt | Reflection |
|---|---|---|
| Review Contract | Read `docs/lab-02/specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md`. List ambiguities, conflicts, dependencies, and the proposed implementation order. Do not write code yet. | Doing this before any code existed surfaced real ambiguities early — e.g., how ownership failures should respond (404 vs 403), which I had to decide and document rather than let the agent guess silently. |
| Implement Development Requester Context | Read the Development Requester requirements, business rules, acceptance criteria, UI specification, API contract, and planned tests. Implement the temporary Lab 2 RequesterUser model, idempotent seed data, active Requester API, Development Requester Selection screen, selected Requester context, and Change Requester behavior. Clearly label this as a testing mechanism, not authentication. Do not add passwords, login, sessions, roles, or Lab 3 functionality. | Scoping the prompt tightly to one Issue kept the agent from also building routing/navigation prematurely — but I still had to explicitly decide how to handle the Lab 1 code that its changes would otherwise overwrite. |
| Create Failing API Tests | Implement the planned API tests for the current Issue first. Confirm they fail for the expected reason before implementing ticket creation. | Writing tests first made a couple of validation edge cases (blank vs. too-short Summary) concrete before I'd even seen the implementation, which made reviewing the actual code faster. |
| Implement UI Increment | Implement only the Create Ticket screen and reusable Zen Green form components required by the current Issue. Preserve the API contract and do not implement My Tickets or Ticket Detail until their specification and failing tests are available. | The "only this Issue" constraint was necessary — without it, the agent tended to build ahead (e.g., adding attachment upload before the Attachment model existed), which I had to catch and remove. |
| Implement My Tickets | Read the My Tickets requirements, API contract, acceptance criteria, and planned tests. Implement only the Requester-owned paginated ticket list, search, filters, sorting, loading, empty, no-results, and failure states. Do not add authentication or IT Staff workflow. | This is where I actually caught a real bug myself, not the agent — a Bootstrap responsive class was missing its mobile-width base case, so the filter row wasn't guaranteed to stack correctly below 768px. |
| Implement Requester Ticket Detail | Implement the Requester Ticket Detail and Attachment lifecycle described in the contract. Ticket header fields are read-only. Enforce ownership in the backend. Support adding, downloading, and soft-removing permitted attachments. Do not add comments, internal notes, Actions Taken, or status changes. | The ownership check needed to be enforced server-side, not just hidden in the UI — I specifically asked for a test proving a different Requester's ticket returns 404, since a passing UI alone wouldn't have proven that. |
| Completion Review | Audit the implementation against every acceptance criterion and planned test. Report missing evidence, skipped tests, untested failure states, and UI-spec deviations. Do not claim completion until corrected. | This step found a genuine bug on its own — an invalid field inside a Prisma `select` block that would have thrown a runtime error the first time that code path actually ran. |
| Reconcile Spec and Implementation | Compare the current schema and API behavior against specification.md. List every field, default value, or business rule where the implementation diverges from the written spec, and reconcile them in the direction I choose. | This caught three real mismatches (missing `isActive` fields, a wrongly-nullable `itPriority`, a derived vs. stored `isRemoved`) that had drifted between an earlier spec draft and what was actually built — a reminder that spec and code can silently diverge if nothing checks them against each other. |

## My Reflection

Working with an AI coding agent made it much easier to keep the Create
Ticket → My Tickets → Ticket Detail → Attachments flow consistent across
issues, since it could carry the same business rules and API contract
through each implementation step instead of me re-deriving them each time.
The most useful discipline was asking it to review the contract and flag
ambiguities before writing code, and to audit against acceptance criteria
at the end of each Issue rather than just trusting a "done" claim. The main
lesson was that I still needed to verify everything myself — running the
actual test suite, checking the database directly, and testing failure
states by hand — rather than assuming generated code was correct just
because it looked complete.
