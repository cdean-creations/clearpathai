const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutLink = document.getElementById("logoutLink");
const refreshBtn = document.getElementById("refreshBtn");
const testLeadBtn = document.getElementById("testLeadBtn");

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function showApp(authenticated) {
  loginView.classList.toggle("hidden", authenticated);
  appView.classList.toggle("hidden", !authenticated);
  logoutLink.classList.toggle("hidden", !authenticated);
}

async function loadConfig() {
  const config = await api("/api/config");
  const b = config.business;
  document.getElementById("businessLine").textContent =
    `${b.receptionistName} · ${b.name} · ${b.vertical}`;
}

async function loadData() {
  const [leadsRes, callsRes] = await Promise.all([
    api("/api/admin/leads"),
    api("/api/admin/calls"),
  ]);

  const leads = leadsRes.leads || [];
  const calls = callsRes.calls || [];

  document.getElementById("leadCount").textContent = String(leads.length);
  document.getElementById("callCount").textContent = String(calls.length);
  document.getElementById("urgentCount").textContent = String(
    leads.filter((l) => l.urgency === "emergency" || l.status === "urgent").length
  );

  const leadsBody = document.getElementById("leadsBody");
  if (!leads.length) {
    leadsBody.innerHTML = `<tr><td colspan="5" class="muted">No leads yet. Place a test call or send a test lead email.</td></tr>`;
  } else {
    leadsBody.innerHTML = leads
      .slice(0, 50)
      .map(
        (lead) => `
      <tr>
        <td>${escapeHtml(fmtDate(lead.createdAt))}</td>
        <td>
          <strong>${escapeHtml(lead.name || "—")}</strong><br />
          <span class="muted">${escapeHtml(lead.phone || "")}</span><br />
          <span class="muted">${escapeHtml(lead.address || "")}</span>
        </td>
        <td>${escapeHtml(lead.issueType || "—")}<br /><span class="muted">${escapeHtml(lead.notes || "")}</span></td>
        <td><span class="badge ${escapeHtml(lead.urgency || "")}">${escapeHtml(lead.urgency || "normal")}</span></td>
        <td><span class="badge ${escapeHtml(lead.status || "")}">${escapeHtml(lead.status || "new")}</span></td>
      </tr>`
      )
      .join("");
  }

  const callsBody = document.getElementById("callsBody");
  if (!calls.length) {
    callsBody.innerHTML = `<tr><td colspan="4" class="muted">No call reports yet. End-of-call reports will appear here after a real call.</td></tr>`;
  } else {
    callsBody.innerHTML = calls
      .slice(0, 50)
      .map(
        (call) => `
      <tr>
        <td>${escapeHtml(fmtDate(call.createdAt || call.updatedAt))}</td>
        <td>${escapeHtml(call.callerPhone || "—")}</td>
        <td>${escapeHtml(call.durationSeconds != null ? `${call.durationSeconds}s` : "—")}</td>
        <td>${escapeHtml((call.summary || "").slice(0, 220))}</td>
      </tr>`
      )
      .join("");
  }
}

async function boot() {
  try {
    const session = await api("/api/admin/session");
    showApp(session.authenticated);
    if (session.authenticated) {
      await loadConfig();
      await loadData();
    }
  } catch (err) {
    console.error(err);
    showApp(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.add("hidden");
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
      }),
    });
    showApp(true);
    await loadConfig();
    await loadData();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  }
});

logoutLink.addEventListener("click", async (event) => {
  event.preventDefault();
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  showApp(false);
});

refreshBtn.addEventListener("click", () => loadData().catch(console.error));

testLeadBtn.addEventListener("click", async () => {
  testLeadBtn.disabled = true;
  try {
    const result = await api("/api/admin/test-lead", { method: "POST", body: "{}" });
    alert(
      result.email?.skipped
        ? "Lead saved. Add RESEND_API_KEY to send email."
        : `Lead saved and email sent (${result.email?.subject || "ok"}).`
    );
    await loadData();
  } catch (err) {
    alert(err.message);
  } finally {
    testLeadBtn.disabled = false;
  }
});

boot();
