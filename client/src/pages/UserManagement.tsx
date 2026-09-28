import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AdminUser, AdminUserError, AdminUserFields, FieldErrors, UserRole,
  createAdminUser, fetchAdminUsers, setAdminInitialPassword, updateAdminUser,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";

const roles: Record<UserRole, string> = { REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" };
const primary = { backgroundColor: zenGreen.primary, color: "white" };
const panel = { backgroundColor: "white", border: "1px solid #E0E5E2", borderRadius: 8, minWidth: 0 };
const passwordGuidance = "Use 10–72 characters including uppercase, lowercase, a digit, and a special character.";
const conflicts: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: "This email address is already in use.",
  SELF_DEACTIVATION_FORBIDDEN: "You cannot deactivate your own account.",
  LAST_ACTIVE_ADMIN_REQUIRED: "At least one active Administrator is required.",
  USER_HAS_REQUESTER_TICKETS: "The role cannot be changed because this account owns Requester Tickets.",
  NOT_FOUND: "This User could not be found. Close the form and refresh the list.",
};

function passwordErrors(password: string, confirmation: string): FieldErrors {
  const errors: FieldErrors = {};
  if (password.length < 10 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) errors.initialPassword = passwordGuidance;
  if (password !== confirmation) errors.confirmPassword = "Passwords must match.";
  return errors;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge text-wrap" style={{ backgroundColor: zenGreen.pale, color: zenGreen.primary }}>{children}</span>;
}

function PasswordFields({ prefix, creating, password, confirmation, setPassword, setConfirmation, errors }: {
  prefix: string; creating: boolean; password: string; confirmation: string;
  setPassword: (value: string) => void; setConfirmation: (value: string) => void; errors: FieldErrors;
}) {
  const [visible, setVisible] = useState({ initialPassword: false, confirmPassword: false });
  return <>
    <p className="small text-muted" id={`${prefix}-guidance`}>{passwordGuidance}</p>
    {(["initialPassword", "confirmPassword"] as const).map(key => {
      const id = `${prefix}-${key}`;
      const label = key === "initialPassword" ? "Initial Password" : creating ? "Confirm Initial Password" : "Confirm Password";
      return <div className="mb-3" key={key}>
        <label className="form-label" htmlFor={id}>{label}</label>
        <div className="input-group">
          <input id={id} className="form-control" type={visible[key] ? "text" : "password"} autoComplete="new-password" value={key === "initialPassword" ? password : confirmation} onChange={e => (key === "initialPassword" ? setPassword : setConfirmation)(e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-error` : `${prefix}-guidance`} />
          <button type="button" className="btn btn-outline-secondary" aria-label={`${visible[key] ? "Hide" : "Show"} ${key === "initialPassword" ? "initial password" : "confirm password"}`} aria-pressed={visible[key]} onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))}>{visible[key] ? "Hide" : "Show"}</button>
        </div>
        {errors[key] && <div id={`${id}-error`} className="small text-danger">{errors[key]}</div>}
      </div>;
    })}
  </>;
}

function UserEditor({ target, close, saved, handleFailure }: {
  target: AdminUser | null; close: () => void;
  saved: (user: AdminUser | null, reset?: boolean) => Promise<void>;
  handleFailure: (error: unknown) => Promise<void>;
}) {
  const [values, setValues] = useState<AdminUserFields>(target ?? { name: "", email: "", role: "REQUESTER", isActive: true });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [resetErrors, setResetErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  async function submit(event: FormEvent, resetting = false) {
    event.preventDefault();
    if (submitting.current) return;
    setMessage("");
    const fields: FieldErrors = {};
    if (!resetting) {
      if (values.name.trim().length < 2 || values.name.trim().length > 100) fields.name = "Name must contain 2–100 characters.";
      if (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) fields.email = "Enter a valid email address of at most 254 characters.";
    }
    if (!target || resetting) Object.assign(fields, passwordErrors(password, confirmation));
    (resetting ? setResetErrors : setErrors)(fields);
    if (Object.keys(fields).length) { setMessage("Check the highlighted fields."); return; }
    submitting.current = true; setBusy(true);
    try {
      if (resetting && target) {
        await setAdminInitialPassword(target.id, { initialPassword: password, confirmPassword: confirmation });
        setPassword(""); setConfirmation("");
        await saved(target, true);
      } else {
        const data: AdminUserFields = { name: values.name.trim(), email: values.email.trim().toLowerCase(), role: values.role, isActive: values.isActive };
        const result = target ? await updateAdminUser(target.id, data) : await createAdminUser({ ...data, initialPassword: password });
        setPassword(""); setConfirmation("");
        await saved(result);
      }
    } catch (error) {
      const known = error instanceof AdminUserError;
      // Only validation responses may supply field text; never render raw
      // server messages for unexpected failures.
      (resetting ? setResetErrors : setErrors)(known && error.status === 400 ? error.fields : {});
      setMessage(known && conflicts[error.code] ? conflicts[error.code] : known && error.status === 400 ? "Check the highlighted fields." : "Could not save the User. Please try again.");
      await handleFailure(error);
    } finally { submitting.current = false; setBusy(false); }
  }

  function inputProps(key: string) {
    return { "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `user-${key}-error` : undefined };
  }
  const fieldError = (key: string) => errors[key] && <div id={`user-${key}-error`} className="small text-danger">{errors[key]}</div>;
  return <section className="p-3" style={panel} aria-labelledby="user-editor-heading">
    <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
      <h2 className="h5 mb-0" id="user-editor-heading" ref={heading} tabIndex={-1}>{target ? "Edit User" : "Create User"}</h2>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={close} disabled={busy}>Cancel</button>
    </div>
    {message && <div role="alert" className="alert alert-danger">{message}</div>}
    <form aria-label={target ? "Edit User" : "Create User"} noValidate onSubmit={e => void submit(e)}>
      <fieldset disabled={busy}>
        {(["name", "email"] as const).map(key => <div className="mb-3" key={key}>
          <label className="form-label" htmlFor={`user-${key}`}>{key === "name" ? "Name" : "Email"}</label>
          <input id={`user-${key}`} className="form-control" type={key === "email" ? "email" : "text"} value={values[key]} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))} {...inputProps(key)} />
          {fieldError(key)}
        </div>)}
        <div className="mb-3"><label className="form-label" htmlFor="user-role">Role</label>
          <select id="user-role" className="form-select" value={values.role} onChange={e => setValues(current => ({ ...current, role: e.target.value as UserRole }))} {...inputProps("role")}>
            {Object.entries(roles).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
          </select>{fieldError("role")}
        </div>
        <div className="form-check form-switch mb-3">
          <input id="user-active" className="form-check-input" type="checkbox" checked={values.isActive} onChange={e => setValues(current => ({ ...current, isActive: e.target.checked }))} {...inputProps("isActive")} />
          <label className="form-check-label" htmlFor="user-active">Active</label>{fieldError("isActive")}
        </div>
        {!target && <PasswordFields prefix="create" creating password={password} confirmation={confirmation} setPassword={setPassword} setConfirmation={setConfirmation} errors={errors} />}
        <button className="btn w-100" style={primary} type="submit">{busy ? "Saving…" : target ? "Save Changes" : "Save User"}</button>
      </fieldset>
    </form>
    {target && <form aria-label="Set New Initial Password" className="mt-4 pt-3 border-top" noValidate onSubmit={e => void submit(e, true)}>
      <h3 className="h6">Set New Initial Password</h3>
      <p className="small text-muted">Existing sessions will end. The User must change this password at their next login.</p>
      <fieldset disabled={busy}>
        <PasswordFields prefix="reset" creating={false} password={password} confirmation={confirmation} setPassword={setPassword} setConfirmation={setConfirmation} errors={resetErrors} />
        <button className="btn btn-outline-secondary w-100" type="submit">{busy ? "Saving…" : "Set New Initial Password"}</button>
      </fieldset>
    </form>}
  </section>;
}

export default function UserManagement() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [success, setSuccess] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ target: AdminUser | null } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (!editor) trigger.current?.focus();
  }, [editor]);

  async function handleFailure(error: unknown) {
    if (!(error instanceof AdminUserError)) return;
    if (error.status === 401 || error.code === "PASSWORD_CHANGE_REQUIRED") {
      setItems([]); setEditor(null);
      await refreshUser();
      navigate(error.status === 401 ? "/login" : "/change-password", { replace: true });
    } else if (error.status === 403) {
      setItems([]); setEditor(null); setForbidden(true);
    }
  }
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setListError("");
    fetchAdminUsers({ search: search.trim(), role: role || undefined }).then(result => {
      if (!cancelled) { setItems(result.items); setLoading(false); }
    }).catch(error => {
      if (cancelled) return;
      setItems([]); setLoading(false);
      setListError("Could not load Users. Please try again.");
      void handleFailure(error);
    });
    return () => { cancelled = true; };
  }, [search, role, revision]);

  function open(target: AdminUser | null, button: HTMLButtonElement) {
    trigger.current = button; setSuccess(""); setEditor({ target });
  }
  function close() {
    setEditor(null);
  }
  async function saved(result: AdminUser | null, reset = false) {
    if (result?.id === user?.id) await refreshUser();
    setSuccess(reset ? "New initial password saved. The User must change it at next login." : editor?.target ? "User changes saved." : "User created.");
    if (!reset) close();
    setRevision(value => value + 1);
  }
  const editButton = (item: AdminUser) => <button type="button" className="btn btn-sm btn-outline-secondary" disabled={Boolean(editor)} aria-label={`Edit ${item.name}`} onClick={e => open(item, e.currentTarget)}>Edit</button>;
  if (forbidden) return <div className="container py-4"><div role="alert" className="alert alert-danger">You do not have permission to manage Users.</div></div>;

  return <div className="container py-4" style={{ maxWidth: 1200, color: zenGreen.text, overflowWrap: "anywhere" }}>
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 className="h4 mb-0">Users</h1>
      <button type="button" className="btn" style={primary} disabled={Boolean(editor)} onClick={e => open(null, e.currentTarget)}>+ Create User</button>
    </div>
    {(loading || success) && <div role="status" className="mb-3">{success || "Loading Users…"}</div>}
    <div className="row g-3">
      <div className={editor ? "col-lg-7 d-none d-lg-block" : "col-12"} style={{ minWidth: 0 }}>
        <section aria-label="User filters" className="p-3 mb-3" style={panel}>
          <div className="row g-3">
            <div className="col-md-8"><label className="form-label" htmlFor="users-search">Search users</label>
              <input id="users-search" className="form-control" type="search" placeholder="Name or email" value={search} onChange={e => { setSearch(e.target.value); setSuccess(""); }} />
            </div>
            <div className="col-md-4"><label className="form-label" htmlFor="users-role">Filter by role</label>
              <select id="users-role" className="form-select" value={role} onChange={e => { setRole(e.target.value as UserRole | ""); setSuccess(""); }}>
                <option value="">All roles</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
        </section>
        {listError ? <div role="alert" className="alert alert-danger">{listError} <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRevision(value => value + 1)}>Retry</button></div> : !loading && items.length === 0 ? <p>{search.trim() || role ? "No Users match your search or role filter." : "No Users yet."}</p> : !loading && <>
          <div className="d-none d-md-block p-2" style={panel}>
            <table className="table align-middle mb-0" aria-label="Users" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead><tr>{["Name", "Email", "Role", "Status", "Edit"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{items.map(item => <tr key={item.id}>
                <td>{item.name}</td><td>{item.email}</td><td><Badge>{roles[item.role]}</Badge></td><td><Badge>{item.isActive ? "Active" : "Inactive"}</Badge></td><td>{editButton(item)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="d-md-none list-unstyled" aria-label="User cards">{items.map(item => <li key={item.id} className="p-3 mb-3" style={panel}>
            <div className="fw-semibold">{item.name}</div><div className="small mb-2">{item.email}</div>
            <div className="d-flex flex-wrap gap-2 mb-3"><Badge>{roles[item.role]}</Badge><Badge>{item.isActive ? "Active" : "Inactive"}</Badge></div>{editButton(item)}
          </li>)}</ul>
        </>}
      </div>
      {editor && <div className="col-12 col-lg-5" style={{ minWidth: 0 }}><UserEditor key={editor.target?.id ?? "create"} target={editor.target} close={close} saved={saved} handleFailure={handleFailure} /></div>}
    </div>
  </div>;
}
