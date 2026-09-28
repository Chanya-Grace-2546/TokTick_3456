import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adminClientFixture, administrator, initialPassword, json, person, renderAdmin } from "./helpers/adminClientFixture.js";

let fixture: ReturnType<typeof adminClientFixture>;
beforeEach(() => { fixture = adminClientFixture(); });
afterEach(() => vi.unstubAllGlobals());

async function openCreate() {
  renderAdmin();
  fireEvent.click(await screen.findByRole("button", { name: /create user/i }));
  return screen.findByRole("form", { name: "Create User" });
}
async function openEdit(name = person.name) {
  renderAdmin();
  const table = await screen.findByRole("table", { name: "Users" });
  fireEvent.click(within(table).getByRole("button", { name: `Edit ${name}` }));
  return screen.findByRole("form", { name: "Edit User" });
}
function change(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label, { exact: true }), { target: { value } });
}
function fillCreate(form: HTMLElement) {
  change(form, "Name", "New Person"); change(form, "Email", "new@example.test");
  change(form, "Role", "IT_STAFF"); change(form, "Initial Password", initialPassword);
  change(form, "Confirm Initial Password", initialPassword);
}

describe("Issue 7 User Management (UI-08, focused UI-09 accessibility)", () => {
  it("renders labelled columns, mobile cards, readable roles and account states", async () => {
    renderAdmin();
    const table = await screen.findByRole("table", { name: "Users" });
    const cards = screen.getByRole("list", { name: "User cards" });
    for (const name of ["Name", "Email", "Role", "Status"]) expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    for (const area of [table, cards]) {
      expect(within(area).getByText(person.name)).toBeInTheDocument();
      expect(within(area).getByText(person.email)).toBeInTheDocument();
      expect(within(area).getByText("Requester")).toBeInTheDocument();
      expect(within(area).getByText("IT Staff")).toBeInTheDocument();
      expect(within(area).getByText("Administrator")).toBeInTheDocument();
      expect(within(area).getAllByText("Active").length).toBeGreaterThan(0);
      expect(within(area).getByText("Inactive")).toBeInTheDocument();
      expect(within(area).getByRole("button", { name: `Edit ${person.name}` })).toBeEnabled();
    }
    expect(screen.queryByRole("button", { name: /delete user/i })).not.toBeInTheDocument();
  });

  it("keeps long names/emails available as text in table and cards", async () => {
    const long = { ...person, name: "LongName".repeat(12), email: `${"long".repeat(50)}@example.test` };
    fixture.list.mockImplementation(async () => json({ items: [long] })); renderAdmin();
    const table = await screen.findByRole("table", { name: "Users" });
    for (const area of [table, screen.getByRole("list", { name: "User cards" })]) {
      expect(within(area).getByText(long.name)).toBeInTheDocument();
      expect(within(area).getByText(long.email)).toBeInTheDocument();
    }
    // JSDOM cannot verify layout/overflow; browser visual evidence stays in Issue 8.
  });

  it("combines name/email search with one role filter", async () => {
    renderAdmin(); await screen.findByRole("table", { name: "Users" });
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "alex@example.test" } });
    fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "REQUESTER" } });
    await waitFor(() => {
      const url = fixture.list.mock.calls.at(-1)![0];
      expect(Object.fromEntries(url.searchParams)).toEqual({ search: "alex@example.test", role: "REQUESTER" });
    });
  });

  it("announces loading until the list resolves", async () => {
    let resolve!: (response: Response) => void;
    fixture.list.mockImplementation(() => new Promise(done => { resolve = done; })); renderAdmin();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/loading/i));
    await act(async () => resolve(json({ items: [] })));
    await screen.findByText(/no users/i);
  });

  it("distinguishes empty Users from no search results", async () => {
    fixture.list.mockImplementation(async () => json({ items: [] })); renderAdmin();
    await screen.findByText(/no users/i);
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "missing" } });
    await screen.findByText(/no.*match|no results/i);
  });

  it.each(["network", "server"])("shows safe %s list failure with Retry", async kind => {
    if (kind === "network") fixture.list.mockRejectedValueOnce(new TypeError("PRIVATE_NETWORK_DETAIL"));
    else fixture.list.mockResolvedValueOnce(json({ error: "UNEXPECTED_ERROR", message: "PRIVATE_DATABASE_DETAIL" }, 500));
    renderAdmin();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not|couldn't|unable/i);
    expect(screen.queryByText(/PRIVATE_/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await screen.findByRole("table", { name: "Users" });
  });

  it("shows Forbidden without protected list data on backend 403", async () => {
    fixture.list.mockResolvedValueOnce(json({ error: "FORBIDDEN" }, 403)); renderAdmin();
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission|forbidden/i);
    expect(screen.queryByText(person.email)).not.toBeInTheDocument();
  });

  it("creates one-role inactive User without submitting confirmation", async () => {
    const form = await openCreate(); fillCreate(form);
    const active = within(form).getByLabelText("Active");
    if ((active as HTMLInputElement).checked) fireEvent.click(active);
    fireEvent.click(within(form).getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(fixture.create).toHaveBeenCalledWith({ name: "New Person", email: "new@example.test", role: "IT_STAFF", isActive: false, initialPassword }));
    expect(await screen.findByRole("status")).toHaveTextContent(/created|saved/i);
  });

  it("rejects mismatched create confirmation locally and preserves fields", async () => {
    const form = await openCreate(); fillCreate(form); change(form, "Confirm Initial Password", "Mismatch!123");
    fireEvent.click(within(form).getByRole("button", { name: "Save User" }));
    expect(await screen.findByText(/passwords.*match/i)).toBeInTheDocument();
    expect(fixture.create).not.toHaveBeenCalled();
    expect(within(form).getByLabelText("Name")).toHaveValue("New Person");
  });

  it.each(["short", "lowercase1!", "UPPERCASE1!", "NoDigitsHere!", "NoSymbols123"])("rejects weak initial password %s before posting", async value => {
    const form = await openCreate(); fillCreate(form);
    change(form, "Initial Password", value); change(form, "Confirm Initial Password", value);
    fireEvent.click(within(form).getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(within(form).getByLabelText("Initial Password", { exact: true })).toHaveAttribute("aria-invalid", "true"));
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it("associates server field validation with its input and retains entered context", async () => {
    fixture.create.mockResolvedValueOnce(json({ error: "VALIDATION_FAILED", fields: { email: "Use a valid email address." } }, 400));
    const form = await openCreate(); fillCreate(form);
    fireEvent.click(within(form).getByRole("button", { name: "Save User" }));
    const email = within(form).getByLabelText("Email");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription("Use a valid email address.");
    expect(email).toHaveValue("new@example.test");
  });

  it.each([["Name", "A"], ["Name", "a".repeat(101)], ["Email", "not-an-email"]])("rejects invalid %s locally", async (label, value) => {
    const form = await openCreate(); fillCreate(form); change(form, label, value);
    // Submit the form to exercise application validation independently of the
    // browser's native email constraint validation (which JSDOM cannot model).
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByLabelText(label)).toHaveAttribute("aria-invalid", "true"));
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it("disables repeated create submission while saving", async () => {
    let resolve!: (value: Response) => void;
    fixture.create.mockImplementation(() => new Promise(done => { resolve = done; }));
    const form = await openCreate(); fillCreate(form);
    const save = within(form).getByRole("button", { name: "Save User" });
    fireEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled()); fireEvent.click(save);
    expect(fixture.create).toHaveBeenCalledTimes(1);
    await act(async () => resolve(json({ ...person, id: 4, mustChangePassword: true }, 201)));
  });

  it("edits name/email/role and deactivates without sending password fields", async () => {
    const form = await openEdit();
    expect(within(form).getByLabelText("Email")).toHaveValue(person.email);
    change(form, "Name", "Updated Person"); change(form, "Email", "updated@example.test"); change(form, "Role", "IT_STAFF");
    fireEvent.click(within(form).getByLabelText("Active"));
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(fixture.edit).toHaveBeenCalledWith(2, { name: "Updated Person", email: "updated@example.test", role: "IT_STAFF", isActive: false }));
    expect(await screen.findByRole("status")).toHaveTextContent(/saved|updated/i);
  });

  it("reactivates an inactive account", async () => {
    const form = await openEdit("Inactive Staff");
    expect(within(form).getByLabelText("Active")).not.toBeChecked();
    fireEvent.click(within(form).getByLabelText("Active"));
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(fixture.edit).toHaveBeenCalledWith(3, expect.objectContaining({ isActive: true })));
  });

  it.each([
    ["EMAIL_ALREADY_EXISTS", /email.*already|already.*email/i],
    ["SELF_DEACTIVATION_FORBIDDEN", /cannot.*deactivate.*own|can't.*deactivate.*own/i],
    ["LAST_ACTIVE_ADMIN_REQUIRED", /at least one active administrator/i],
    ["USER_HAS_REQUESTER_TICKETS", /role.*tickets|tickets.*role/i],
  ] as const)("explains %s and preserves the rejected edit", async (error, message) => {
    fixture.edit.mockResolvedValueOnce(json({ error }, 409));
    const form = await openEdit(); change(form, "Name", "Keep My Input");
    fireEvent.click(within(form).getByLabelText("Active"));
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(within(form).getByLabelText("Name")).toHaveValue("Keep My Input");
    expect(within(form).getByLabelText("Active")).not.toBeChecked();
    expect(screen.getAllByText(person.email).length).toBeGreaterThan(0);
  });

  it("shows duplicate-email feedback on create too", async () => {
    fixture.create.mockResolvedValueOnce(json({ error: "EMAIL_ALREADY_EXISTS" }, 409));
    const form = await openCreate(); fillCreate(form);
    fireEvent.click(within(form).getByRole("button", { name: "Save User" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/email.*already|already.*email/i);
    expect(within(form).getByLabelText("Email")).toHaveValue("new@example.test");
  });

  it("shows safe save failure and permits retry with entered values", async () => {
    fixture.edit.mockRejectedValueOnce(new TypeError("PRIVATE_DETAIL"));
    const form = await openEdit(); change(form, "Name", "Retry Name");
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not|couldn't|unable/i);
    expect(screen.queryByText(/PRIVATE_DETAIL/)).not.toBeInTheDocument();
    expect(within(form).getByLabelText("Name")).toHaveValue("Retry Name");
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(fixture.edit).toHaveBeenCalledTimes(2));
  });

  async function resetForm(name = person.name) {
    await openEdit(name);
    return screen.findByRole("form", { name: "Set New Initial Password" });
  }
  function fillReset(form: HTMLElement) {
    change(form, "Initial Password", initialPassword); change(form, "Confirm Password", initialPassword);
  }
  it("reissues via a separate labelled password form and handles 204 success", async () => {
    const form = await resetForm(); fillReset(form);
    fireEvent.click(within(form).getByRole("button", { name: "Set New Initial Password" }));
    await waitFor(() => expect(fixture.reset).toHaveBeenCalledWith(2, { initialPassword, confirmPassword: initialPassword }));
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/password/i);
  });
  it("rejects reset mismatch locally", async () => {
    const form = await resetForm(); fillReset(form); change(form, "Confirm Password", "Different!123");
    fireEvent.click(within(form).getByRole("button", { name: "Set New Initial Password" }));
    await screen.findByText(/passwords.*match/i);
    expect(fixture.reset).not.toHaveBeenCalled();
  });
  it("disables repeated reset submissions until the 204 response arrives", async () => {
    let resolve!: (value: Response) => void;
    fixture.reset.mockImplementation(() => new Promise(done => { resolve = done; }));
    const form = await resetForm(); fillReset(form);
    const save = within(form).getByRole("button", { name: "Set New Initial Password" });
    fireEvent.click(save); await waitFor(() => expect(save).toBeDisabled()); fireEvent.click(save);
    expect(fixture.reset).toHaveBeenCalledTimes(1);
    await act(async () => resolve(new Response(null, { status: 204 })));
  });

  it.each(["create", "reset"])("provides separate accessible show/hide controls for both %s password fields", async mode => {
    const form = mode === "create" ? await openCreate() : await resetForm();
    const confirmLabel = mode === "create" ? "Confirm Initial Password" : "Confirm Password";
    for (const [label, control] of [["Initial Password", "initial password"], [confirmLabel, "confirm password"]]) {
      const input = within(form).getByLabelText(label, { exact: true });
      expect(input).toHaveAttribute("type", "password");
      fireEvent.click(within(form).getByRole("button", { name: `Show ${control}` }));
      expect(input).toHaveAttribute("type", "text");
      fireEvent.click(within(form).getByRole("button", { name: `Hide ${control}` }));
      expect(input).toHaveAttribute("type", "password");
    }
  });
  it("retains reset context after server validation failure", async () => {
    fixture.reset.mockResolvedValueOnce(json({ error: "VALIDATION_FAILED", fields: { initialPassword: "Choose a valid initial password." } }, 400));
    const form = await resetForm(); fillReset(form);
    fireEvent.click(within(form).getByRole("button", { name: "Set New Initial Password" }));
    await screen.findByText("Choose a valid initial password.");
    expect(within(form).getByLabelText("Initial Password", { exact: true })).toHaveValue(initialPassword);
  });

  it("refreshes current identity after editing oneself", async () => {
    fixture.edit.mockImplementation(async (_id, body) => {
      fixture.state.user = { ...administrator, ...body }; return json(fixture.state.user);
    });
    const form = await openEdit(administrator.name); change(form, "Name", "Renamed Admin");
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    await screen.findByRole("button", { name: /Renamed Admin.*▾/ });
    expect(fixture.me.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("removes admin navigation and management data after permitted self-demotion", async () => {
    fixture.edit.mockImplementation(async () => { fixture.state.user = { ...administrator, role: "IT_STAFF" }; return json(fixture.state.user); });
    const form = await openEdit(administrator.name); change(form, "Role", "IT_STAFF");
    fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Admin / Users" })).not.toBeInTheDocument());
    expect(screen.queryByRole("table", { name: "Users" })).not.toBeInTheDocument();
    expect(fixture.me.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("refreshes auth and returns to Login after resetting oneself", async () => {
    fixture.reset.mockImplementation(async () => { fixture.state.user = null; return new Response(null, { status: 204 }); });
    const form = await resetForm(administrator.name); fillReset(form);
    fireEvent.click(within(form).getByRole("button", { name: "Set New Initial Password" }));
    await screen.findByRole("button", { name: /sign in/i });
    expect(fixture.me.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it.each([401, 403])("handles mutation auth failure %i without retaining management content", async status => {
    fixture.edit.mockImplementation(async () => {
      fixture.state.user = status === 401 ? null : { ...administrator, mustChangePassword: true };
      return json({ error: status === 401 ? "UNAUTHENTICATED" : "PASSWORD_CHANGE_REQUIRED" }, status);
    });
    const form = await openEdit(); fireEvent.click(within(form).getByRole("button", { name: "Save Changes" }));
    if (status === 401) await screen.findByRole("button", { name: /sign in/i });
    else await screen.findByLabelText(/confirm new password/i);
    expect(screen.queryByRole("table", { name: "Users" })).not.toBeInTheDocument();
  });

  it("supports keyboard opening/closing, labelled controls, visibility toggles and focus return", async () => {
    const user = userEvent.setup(); renderAdmin();
    const trigger = await screen.findByRole("button", { name: /create user/i });
    trigger.focus(); await user.keyboard("{Enter}");
    const form = await screen.findByRole("form", { name: "Create User" });
    for (const label of ["Name", "Email", "Role", "Active", "Initial Password", "Confirm Initial Password"]) {
      expect(within(form).getByLabelText(label, { exact: true })).toBeEnabled();
    }
    const password = within(form).getByLabelText("Initial Password", { exact: true });
    expect(password).toHaveAttribute("type", "password");
    const show = within(form).getByRole("button", { name: "Show initial password" });
    show.focus(); await user.keyboard("{Enter}"); expect(password).toHaveAttribute("type", "text");
    await user.click(within(form).getByRole("button", { name: "Hide initial password" }));
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /cancel|close.*user/i }));
    expect(trigger).toHaveFocus();
  });
});
