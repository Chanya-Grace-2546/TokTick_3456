# Lab 1 — Automated Tests

Test files: `tests/lab-01/`

| Test ID | File | Tool | Test Description |
|---------|------|------|-------------------|
| API-01 | tests/lab-01/health.test.ts | Supertest | Health endpoint returns 200 and status = ok |
| API-02 | tests/lab-01/categories.test.ts | Supertest | Categories endpoint returns the four seeded categories in id order |
| UI-01 | tests/lab-01/App.test.tsx | Vitest | TokTickIT heading renders |
| UI-02 | tests/lab-01/App.test.tsx | Vitest | Shows Online status and the seeded categories on a successful check |
| UI-03 | tests/lab-01/App.test.tsx | Vitest | Shows an Offline error message when the backend is unavailable |
