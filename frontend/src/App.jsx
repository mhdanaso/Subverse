import { useEffect, useState } from "react";
import { apiRequest } from "./lib/api";
import { supabase } from "./lib/supabase";
import "./App.css";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "customers", label: "Customers", icon: "♙" },
  { id: "products", label: "Products", icon: "▦" },
  { id: "plans", label: "Plans", icon: "◇" },
  { id: "subscriptions", label: "Subscriptions", icon: "↻" },
  { id: "invoices", label: "Invoices", icon: "▤" },
  { id: "discounts", label: "Discounts", icon: "%" },
];

const RESOURCE_CONFIG = {
  customers: {
    title: "Customers",
    endpoint: "/api/customers",
    fields: [
      { name: "name", label: "Customer name", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
    ],
    columns: ["name", "email", "phone", "created_at"],
  },
  products: {
    title: "Products",
    endpoint: "/api/products",
    fields: [
      { name: "name", label: "Product name", required: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
    columns: ["name", "description", "is_active", "created_at"],
  },
  plans: {
    title: "Plans",
    endpoint: "/api/plans",
    fields: [
      { name: "product_id", label: "Product", type: "select", source: "products", required: true },
      { name: "name", label: "Plan name", required: true },
      { name: "amount", label: "Price", type: "number", min: "0", step: "0.01", required: true },
      { name: "currency", label: "Currency", defaultValue: "USD", required: true },
      {
        name: "billing_interval",
        label: "Billing interval",
        type: "select-static",
        options: ["day", "week", "month", "year"],
        required: true,
      },
      { name: "interval_count", label: "Every", type: "number", min: "1", step: "1", defaultValue: "1", required: true },
    ],
    columns: ["name", "product_id", "amount", "currency", "billing_interval", "interval_count", "is_active"],
  },
  subscriptions: {
    title: "Subscriptions",
    endpoint: "/api/subscriptions",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", source: "customers", required: true },
      { name: "plan_id", label: "Plan", type: "select", source: "plans", required: true },
    ],
    columns: ["customer_id", "plan_id", "status", "current_period_start", "current_period_end", "cancel_at_period_end"],
  },
  discounts: {
    title: "Discounts",
    endpoint: "/api/discounts",
    fields: [
      { name: "code", label: "Code", required: true },
      {
        name: "discount_type",
        label: "Type",
        type: "select-static",
        options: ["percent", "fixed"],
        required: true,
      },
      { name: "value", label: "Value", type: "number", min: "0.01", step: "0.01", required: true },
    ],
    columns: ["code", "discount_type", "value", "is_active", "expires_at"],
  },
};

const EDIT_FIELDS = {
  customers: [
    { name: "name", label: "Customer name", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone" },
  ],
  products: [
    { name: "name", label: "Product name", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "is_active", label: "Active", type: "select-static", options: ["true", "false"], required: true },
  ],
  plans: [
    { name: "name", label: "Plan name", required: true },
    { name: "amount", label: "Price", type: "number", min: "0", step: "0.01", required: true },
    { name: "currency", label: "Currency", required: true },
    { name: "billing_interval", label: "Billing interval", type: "select-static", options: ["day", "week", "month", "year"], required: true },
    { name: "interval_count", label: "Interval count", type: "number", min: "1", step: "1", required: true },
    { name: "is_active", label: "Active", type: "select-static", options: ["true", "false"], required: true },
  ],
  discounts: [
    { name: "value", label: "Value", type: "number", min: "0.01", step: "0.01", required: true },
    { name: "is_active", label: "Active", type: "select-static", options: ["true", "false"], required: true },
    { name: "starts_at", label: "Starts at", type: "datetime-local" },
    { name: "expires_at", label: "Expires at", type: "datetime-local" },
  ],
};

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!supabase) {
      setError("Add the Supabase URL and publishable key to frontend/.env.local, then restart Vite.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (authError) throw authError;
        if (data.session) {
          setNotice("Account created. You are signed in.");
        } else {
          setNotice("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-lockup">
          <span className="brand-mark">S</span>
          <span>Subverse</span>
        </div>
        <p className="eyebrow">SUBSCRIPTION OPERATIONS</p>
        <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">
          {mode === "signin" ? "Sign in to manage your subscription business." : "Use your team account to get started."}
        </p>

        <div className="auth-switch" role="tablist" aria-label="Account access">
          <button className={mode === "signin" ? "selected" : ""} onClick={() => setMode("signin")} type="button">
            Sign in
          </button>
          <button className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")} type="button">
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="stack-form">
          {mode === "signup" && (
            <label>
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>
          {notice && <p className="notice success">{notice}</p>}
          {error && <p className="notice error">{error}</p>}
          <button className="primary-button wide" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="auth-footnote">Protected by Supabase Auth. Billing data is served by the Subverse API.</p>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setCheckingSession(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return <main className="loading-screen">Loading your workspace…</main>;
  }

  if (!session) return <AuthScreen />;

  return <Dashboard session={session} onSignOut={() => supabase.auth.signOut()} />;
}

function Dashboard({ session, onSignOut }) {
  const [activePage, setActivePage] = useState("overview");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [lookups, setLookups] = useState({ customers: [], products: [], plans: [], subscriptions: [], discounts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (activePage === "overview") {
          const overview = await apiRequest("/api/overview", session);
          if (active) setData(overview);
        } else if (activePage === "invoices") {
          const [invoices, customers, subscriptions, discounts] = await Promise.all([
            apiRequest("/api/invoices", session),
            apiRequest("/api/customers", session),
            apiRequest("/api/subscriptions", session),
            apiRequest("/api/discounts", session),
          ]);
          if (active) {
            setData(invoices);
            setLookups((current) => ({ ...current, customers, subscriptions, discounts }));
          }
        } else {
          const config = RESOURCE_CONFIG[activePage];
          const rows = await apiRequest(config.endpoint, session);
          const sourceNames = [...new Set(config.fields.map((field) => field.source).filter(Boolean))];
          const lookupResults = await Promise.all(
            sourceNames.map((source) => apiRequest(`/api/${source}`, session).then((result) => [source, result])),
          );
          if (active) {
            setData(rows);
            setLookups((current) => ({ ...current, ...Object.fromEntries(lookupResults) }));
          }
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [activePage, revision, session]);

  async function refresh() {
    setRevision((value) => value + 1);
  }

  const currentNav = NAV_ITEMS.find((item) => item.id === activePage);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark">S</span>
          <span>Subverse</span>
        </div>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="avatar">{(session.user.email || "U").slice(0, 1).toUpperCase()}</span>
            <span className="user-email">{session.user.email}</span>
          </div>
          <button className="signout-button" onClick={onSignOut} type="button">Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SUBVERSE / WORKSPACE</p>
            <h1>{currentNav?.label || "Overview"}</h1>
          </div>
          <div className="connection-pill"><span /> Connected to Supabase Auth</div>
        </header>

        <section className="content-area">
          {error && <div className="notice error page-error">{error}</div>}
          {loading ? (
            <div className="loading-panel">Loading {currentNav?.label.toLowerCase()}…</div>
          ) : activePage === "overview" ? (
            <Overview data={data} />
          ) : activePage === "invoices" ? (
            <InvoicePanel
              invoices={data || []}
              lookups={lookups}
              session={session}
              onCreated={refresh}
              onError={setError}
            />
          ) : (
            <ResourcePanel
              key={activePage}
              page={activePage}
              rows={data || []}
              lookups={lookups}
              session={session}
              onCreated={refresh}
              onError={setError}
            />
          )}
        </section>
        <footer className="page-footer">Subverse MVP · Business data is handled by the protected API</footer>
      </main>
    </div>
  );
}

function Overview({ data }) {
  const metrics = [
    { label: "Customers", value: data?.customer_count ?? 0, hint: "In your workspace" },
    { label: "Active subscriptions", value: data?.active_subscriptions ?? 0, hint: "Currently active" },
    { label: "Open invoices", value: data?.open_invoice_count ?? 0, hint: "Awaiting payment" },
    { label: "Monthly revenue", value: formatMoneyList(data?.monthly_revenue), hint: "Successful payments this month" },
  ];

  return (
    <div className="overview-grid">
      <section className="welcome-panel">
        <div>
          <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
          <h2>Keep every subscription moving.</h2>
          <p>Track customers, recurring plans, invoices, and payments from one place.</p>
        </div>
        <div className="welcome-decoration"><span>↗</span><i /><i /><i /></div>
      </section>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className="metric-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            <span className="metric-hint">{metric.hint}</span>
          </article>
        ))}
      </div>
      <section className="insight-card">
        <div>
          <p className="eyebrow">RECURRING REVENUE</p>
          <h3>Monthly recurring revenue</h3>
        </div>
        <div className="currency-summary">
          {(data?.monthly_recurring_revenue || []).length ? (
            data.monthly_recurring_revenue.map((entry) => (
              <div className="currency-row" key={entry.currency}>
                <span>{entry.currency}</span><strong>{formatMoney(entry.amount, entry.currency)}</strong>
              </div>
            ))
          ) : <span className="muted">No active subscription revenue yet.</span>}
        </div>
      </section>
      <section className="insight-card">
        <div>
          <p className="eyebrow">PAYMENT FOLLOW-UP</p>
          <h3>Outstanding invoices</h3>
        </div>
        <div className="currency-summary">
          {(data?.outstanding_invoices || []).length ? (
            data.outstanding_invoices.map((entry) => (
              <div className="currency-row" key={entry.currency}>
                <span>{entry.currency}</span><strong>{formatMoney(entry.amount, entry.currency)}</strong>
              </div>
            ))
          ) : <span className="muted">No open invoice balance.</span>}
        </div>
      </section>
    </div>
  );
}

function ResourcePanel({ page, rows, lookups, session, onCreated, onError }) {
  const config = RESOURCE_CONFIG[page];
  const [form, setForm] = useState(() => initialForm(config.fields));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const hasActions = ["customers", "products", "plans", "subscriptions", "discounts"].includes(page);

  function changeField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function updateRow(row, changes) {
    setBusy(true);
    onError("");
    try {
      await apiRequest(`${config.endpoint}/${row.id}`, session, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setEditingRow(null);
      await onCreated();
    } catch (updateError) {
      onError(updateError.message);
    } finally {
      setBusy(false);
    }
  }

  function startEditing(row) {
    setEditingRow(row);
    setEditForm(Object.fromEntries(EDIT_FIELDS[page].map((field) => {
      const value = row[field.name];
      if (field.type === "datetime-local") return [field.name, toDateTimeLocal(value)];
      if (field.type === "select-static" && field.name === "is_active") return [field.name, String(value)];
      return [field.name, value ?? ""];
    })));
    onError("");
  }

  async function saveEdit(event) {
    event.preventDefault();
    const changes = {};
    for (const field of EDIT_FIELDS[page]) {
      const value = editForm[field.name];
      if (field.type === "number") changes[field.name] = Number(value);
      else if (field.name === "is_active") changes[field.name] = value === "true";
      else if (field.type === "datetime-local") changes[field.name] = value ? new Date(value).toISOString() : null;
      else changes[field.name] = value;
    }
    await updateRow(editingRow, changes);
  }

  function changeEditField(name, value) {
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  async function cancelSubscription(row) {
    if (!window.confirm("Cancel this subscription now? This ends it immediately.")) return;
    onError("");
    try {
      await apiRequest(`/api/subscriptions/${row.id}/cancel?at_period_end=false`, session, {
        method: "POST",
      });
      await onCreated();
    } catch (cancelError) {
      onError(cancelError.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    onError("");
    try {
      const payload = {};
      for (const field of config.fields) {
        const raw = form[field.name];
        if (raw === "" && !field.required) continue;
        if (field.type === "number") payload[field.name] = Number(raw);
        else if (field.type === "boolean") payload[field.name] = raw === "true";
        else payload[field.name] = raw;
      }
      await apiRequest(config.endpoint, session, { method: "POST", body: JSON.stringify(payload) });
      setForm(initialForm(config.fields));
      setNotice(`${config.title.slice(0, -1)} added.`);
      await onCreated();
    } catch (submitError) {
      onError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel create-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">ADD TO WORKSPACE</p><h2>New {config.title.slice(0, -1).toLowerCase()}</h2></div>
          <span className="heading-symbol">＋</span>
        </div>
        <form className="stack-form compact-form" onSubmit={submit}>
          {config.fields.map((field) => (
            <FormField key={field.name} field={field} value={form[field.name] ?? ""} onChange={changeField} lookups={lookups} />
          ))}
          {notice && <p className="notice success">{notice}</p>}
          <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : `Add ${config.title.slice(0, -1).toLowerCase()}`}</button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading table-heading">
          <div><p className="eyebrow">WORKSPACE RECORDS</p><h2>{config.title}</h2></div>
          <span className="count-badge">{rows.length}</span>
        </div>
        {editingRow && (
          <form className="edit-card" onSubmit={saveEdit}>
            <div className="edit-card-heading">
              <div><p className="eyebrow">UPDATE RECORD</p><h3>{`Edit ${config.title.slice(0, -1).toLowerCase()}`}</h3></div>
              <button className="close-button" type="button" onClick={() => setEditingRow(null)} aria-label="Close editor">×</button>
            </div>
            <div className="edit-fields">
              {EDIT_FIELDS[page].map((field) => (
                <FormField key={field.name} field={field} value={editForm[field.name] ?? ""} onChange={changeEditField} lookups={lookups} />
              ))}
            </div>
            <div className="edit-actions">
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
              <button className="text-button" type="button" onClick={() => setEditingRow(null)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="table-scroll">
          <table>
            <thead><tr>{config.columns.map((column) => <th key={column}>{humanize(column)}</th>)}{hasActions && <th>Actions</th>}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
                  {hasActions && (
                    <td>
                      {EDIT_FIELDS[page] && (
                        <button className="text-button" type="button" onClick={() => startEditing(row)}>Edit</button>
                      )}
                      {["products", "plans", "discounts"].includes(page) && row.is_active !== undefined && (
                        <button className="text-button" type="button" onClick={() => updateRow(row, { is_active: !row.is_active })}>
                          {row.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                      {page === "subscriptions" && row.status !== "canceled" && (
                        <button className="text-button danger-link" type="button" onClick={() => cancelSubscription(row)}>Cancel now</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && <tr><td className="empty-cell" colSpan={config.columns.length + (hasActions ? 1 : 0)}>No records yet. Add the first one using the form.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InvoicePanel({ invoices, lookups, session, onCreated, onError }) {
  const [form, setForm] = useState({ customer_id: "", subscription_id: "", discount_id: "", currency: "USD", tax_amount: "0", description: "Subscription charge", quantity: "1", unit_amount: "" });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payment, setPayment] = useState({ amount: "", status: "pending", provider_reference: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function change(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createInvoice(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    onError("");
    try {
      const payload = {
        customer_id: form.customer_id,
        subscription_id: form.subscription_id || null,
        discount_id: form.discount_id || null,
        currency: form.currency,
        tax_amount: Number(form.tax_amount),
        items: [{ description: form.description, quantity: Number(form.quantity), unit_amount: Number(form.unit_amount) }],
      };
      await apiRequest("/api/invoices", session, { method: "POST", body: JSON.stringify(payload) });
      setNotice("Invoice created.");
      setForm((current) => ({ ...current, description: "Subscription charge", quantity: "1", unit_amount: "", tax_amount: "0" }));
      await onCreated();
    } catch (createError) {
      onError(createError.message);
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!selectedInvoice) return;
    setBusy(true);
    onError("");
    try {
      await apiRequest(`/api/invoices/${selectedInvoice.id}/payments`, session, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payment.amount || selectedInvoice.total_amount),
          currency: selectedInvoice.currency.trim(),
          status: payment.status,
          provider: "manual",
          provider_reference: payment.provider_reference || null,
        }),
      });
      setNotice("Manual payment record added. No card was charged.");
      setSelectedInvoice(null);
      await onCreated();
    } catch (paymentError) {
      onError(paymentError.message);
    } finally {
      setBusy(false);
    }
  }

  async function openPaymentForm(invoice) {
    setBusy(true);
    onError("");
    try {
      const payments = await apiRequest(`/api/invoices/${invoice.id}/payments`, session);
      const paid = payments
        .filter((entry) => entry.status === "succeeded")
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const remaining = Math.max(0, Number(invoice.total_amount) - paid);
      setSelectedInvoice(invoice);
      setPayment({ amount: remaining.toFixed(2), status: "pending", provider_reference: "" });
      setNotice("");
    } catch (loadError) {
      onError(loadError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-grid invoice-grid">
      <section className="panel create-panel">
        <div className="panel-heading"><div><p className="eyebrow">BILLING</p><h2>Create invoice</h2></div><span className="heading-symbol">＋</span></div>
        <form className="stack-form compact-form" onSubmit={createInvoice}>
          <FormField field={{ name: "customer_id", label: "Customer", type: "select", source: "customers", required: true }} value={form.customer_id} onChange={change} lookups={lookups} />
          <FormField field={{ name: "subscription_id", label: "Subscription (optional)", type: "select", source: "subscriptions" }} value={form.subscription_id} onChange={change} lookups={lookups} />
          <FormField field={{ name: "discount_id", label: "Discount (optional)", type: "select", source: "discounts" }} value={form.discount_id} onChange={change} lookups={lookups} />
          <label>Currency<input value={form.currency} maxLength={3} onChange={(event) => change("currency", event.target.value.toUpperCase())} required /></label>
          <label>Line description<input value={form.description} onChange={(event) => change("description", event.target.value)} required /></label>
          <div className="field-row">
            <label>Quantity<input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => change("quantity", event.target.value)} required /></label>
            <label>Unit price<input type="number" min="0" step="0.01" value={form.unit_amount} onChange={(event) => change("unit_amount", event.target.value)} required /></label>
          </div>
          <label>Tax amount<input type="number" min="0" step="0.01" value={form.tax_amount} onChange={(event) => change("tax_amount", event.target.value)} /></label>
          {notice && <p className="notice success">{notice}</p>}
          <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : "Create invoice"}</button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading table-heading"><div><p className="eyebrow">BILLING HISTORY</p><h2>Invoices</h2></div><span className="count-badge">{invoices.length}</span></div>
        <div className="invoice-list">
          {invoices.map((invoice) => (
            <article className="invoice-row" key={invoice.id}>
              <div className="invoice-main"><strong>{invoice.invoice_number}</strong><span>{customerName(invoice.customer_id, lookups.customers)}</span></div>
              <div className="invoice-amount"><strong>{formatMoney(invoice.total_amount, invoice.currency)}</strong><StatusBadge value={invoice.status} /></div>
              {invoice.status !== "paid" && invoice.status !== "void" && (
                <button className="text-button" type="button" disabled={busy} onClick={() => openPaymentForm(invoice)}>
                  {busy ? "Loading…" : "Record payment"}
                </button>
              )}
            </article>
          ))}
          {!invoices.length && <div className="empty-state">No invoices yet. Create one to start your billing history.</div>}
        </div>
        {selectedInvoice && (
          <form className="payment-form" onSubmit={recordPayment}>
            <div className="payment-form-heading"><div><p className="eyebrow">MANUAL RECORD</p><h3>{selectedInvoice.invoice_number}</h3></div><button type="button" className="close-button" onClick={() => setSelectedInvoice(null)} aria-label="Close">×</button></div>
            <p className="muted small-copy">This records a payment you have already received; it does not charge a card.</p>
            <div className="field-row">
              <label>Amount<input type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required /></label>
              <label>Status<select value={payment.status} onChange={(event) => setPayment((current) => ({ ...current, status: event.target.value }))}><option value="pending">Pending</option><option value="succeeded">Received</option><option value="failed">Failed</option></select></label>
            </div>
            <label>Reference (optional)<input value={payment.provider_reference} onChange={(event) => setPayment((current) => ({ ...current, provider_reference: event.target.value }))} /></label>
            <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : "Save payment record"}</button>
          </form>
        )}
      </section>
    </div>
  );
}

function FormField({ field, value, onChange, lookups }) {
  const common = {
    required: Boolean(field.required),
    value,
    onChange: (event) => onChange(field.name, event.target.value),
  };
  if (field.type === "textarea") {
    return <label>{field.label}<textarea {...common} rows="3" /></label>;
  }
  if (field.type === "select-static") {
    return <label>{field.label}<select {...common}><option value="">Choose…</option>{field.options.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}</select></label>;
  }
  if (field.type === "select") {
    const options = lookups[field.source] || [];
    return (
      <label>{field.label}
        <select {...common}>
          <option value="">{options.length ? "Choose…" : "No records available"}</option>
          {options.map((option) => <option key={option.id} value={option.id}>{lookupLabel(field.source, option)}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label>{field.label}
      <input
        type={field.type || "text"}
        min={field.min}
        max={field.max}
        step={field.step}
        required={Boolean(field.required)}
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
    </label>
  );
}

function initialForm(fields) {
  return Object.fromEntries(fields.map((field) => [field.name, field.defaultValue || ""]));
}

function lookupLabel(source, row) {
  if (source === "customers") return row.name;
  if (source === "products") return row.name;
  if (source === "plans") return `${row.name} · ${formatMoney(row.amount, row.currency)}`;
  if (source === "subscriptions") return `${String(row.id).slice(0, 8)} · ${row.status}`;
  if (source === "discounts") return `${row.code} · ${row.discount_type} ${row.value}`;
  return String(row.id).slice(0, 8);
}

function customerName(customerId, customers) {
  return customers?.find((customer) => customer.id === customerId)?.name || String(customerId).slice(0, 8);
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (String(value).includes("T") && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleDateString();
  }
  if (typeof value === "string" && value.length > 24 && value.includes("-")) return `${value.slice(0, 8)}…`;
  return String(value);
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatMoney(value, currency = "USD") {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.trim(), maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatMoneyList(entries = []) {
  return entries.length ? entries.map((entry) => formatMoney(entry.amount, entry.currency)).join(" · ") : "—";
}

function humanize(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ value }) {
  return <span className={`status-badge status-${String(value).toLowerCase()}`}>{humanize(String(value))}</span>;
}

export default App;
