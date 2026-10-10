(function () {
  const C = window.ZULAKIAI_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); };
  const fmt = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "");

  const ok = C.SUPABASE_URL && !C.SUPABASE_URL.includes("YOUR-PROJECT") && C.SUPABASE_ANON_KEY && !C.SUPABASE_ANON_KEY.includes("YOUR-ANON");
  if (!ok) { $("#loginHint").textContent = "Add your Supabase URL and anon key in config.js first."; $("#loginBtn").disabled = true; return; }
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const BUCKET = C.STORAGE_BUCKET || "zulakiai-media";

  // ---------- Entity definitions ----------
  const ENT = {
    news: { label: "News", icon: "📰", table: "news", order: ["published_at", false],
      cols: [["image_url", "img"], ["title"], ["published_at", "date"], ["published", "bool"]],
      fields: [{ k: "title", l: "Title", t: "text", req: 1 }, { k: "summary", l: "Short summary", t: "textarea", rows: 2 }, { k: "body", l: "Full text", t: "textarea", rows: 7 },
        { k: "image_url", l: "Cover image", t: "image" }, { k: "published_at", l: "Publish date", t: "datetime" }, { k: "published", l: "Visible on website", t: "checkbox", def: true }] },
    events: { label: "Events", icon: "📅", table: "events", order: ["starts_at", true],
      cols: [["title"], ["starts_at", "datetime"], ["location"], ["published", "bool"]],
      fields: [{ k: "title", l: "Title", t: "text", req: 1 }, { k: "description", l: "Description", t: "textarea", rows: 4 }, { k: "location", l: "Location", t: "text" },
        { k: "starts_at", l: "Starts at", t: "datetime", req: 1 }, { k: "image_url", l: "Image", t: "image" }, { k: "published", l: "Visible on website", t: "checkbox", def: true }] },
    programs: { label: "Programs", icon: "🎓", table: "programs", order: ["sort_order", true],
      cols: [["icon"], ["title"], ["level"], ["sort_order"], ["published", "bool"]],
      fields: [{ k: "title", l: "Title", t: "text", req: 1 }, { k: "level", l: "Level (e.g. Grades 1–6)", t: "text" }, { k: "icon", l: "Emoji icon", t: "text", def: "📘" },
        { k: "description", l: "Description", t: "textarea", rows: 4 }, { k: "sort_order", l: "Order (small first)", t: "number", def: 0 }, { k: "published", l: "Visible on website", t: "checkbox", def: true }] },
    staff: { label: "Staff", icon: "👩‍🏫", table: "staff", order: ["sort_order", true],
      cols: [["photo_url", "img"], ["full_name"], ["position"], ["sort_order"], ["published", "bool"]],
      fields: [{ k: "full_name", l: "Full name", t: "text", req: 1 }, { k: "position", l: "Position", t: "text" }, { k: "bio", l: "Short bio", t: "textarea", rows: 3 },
        { k: "photo_url", l: "Photo", t: "image" }, { k: "sort_order", l: "Order (small first)", t: "number", def: 0 }, { k: "published", l: "Visible on website", t: "checkbox", def: true }] },
    gallery: { label: "Gallery", icon: "🖼️", table: "gallery", order: ["created_at", false],
      cols: [["image_url", "img"], ["caption"], ["created_at", "date"], ["published", "bool"]],
      fields: [{ k: "image_url", l: "Photo", t: "image", req: 1 }, { k: "caption", l: "Caption", t: "text" }, { k: "published", l: "Visible on website", t: "checkbox", def: true }] },
    applications: { label: "Applications", icon: "📝", table: "applications", order: ["created_at", false], noAdd: true, badge: { col: "status", val: "new" },
      cols: [["student_name"], ["grade_applying"], ["parent_name"], ["parent_phone"], ["status", "status"], ["created_at", "date"]],
      fields: [{ k: "status", l: "Status", t: "select", opts: ["new", "reviewing", "accepted", "rejected"] },
        { k: "student_name", l: "Student", t: "text", ro: 1 }, { k: "date_of_birth", l: "Date of birth", t: "text", ro: 1 }, { k: "grade_applying", l: "Applying for", t: "text", ro: 1 },
        { k: "previous_school", l: "Previous school", t: "text", ro: 1 }, { k: "parent_name", l: "Parent / guardian", t: "text", ro: 1 }, { k: "parent_phone", l: "Phone", t: "text", ro: 1 },
        { k: "parent_email", l: "Email", t: "text", ro: 1 }, { k: "address", l: "Address", t: "text", ro: 1 }, { k: "notes", l: "Notes", t: "textarea", rows: 3, ro: 1 }] },
    messages: { label: "Messages", icon: "✉️", table: "messages", order: ["created_at", false], noAdd: true, badge: { col: "is_read", val: false },
      cols: [["name"], ["email"], ["subject"], ["created_at", "date"], ["is_read", "read"]],
      fields: [{ k: "is_read", l: "Mark as read", t: "checkbox" }, { k: "name", l: "From", t: "text", ro: 1 }, { k: "email", l: "Email", t: "text", ro: 1 },
        { k: "subject", l: "Subject", t: "text", ro: 1 }, { k: "message", l: "Message", t: "textarea", rows: 7, ro: 1 }] },
  };
  const SETTINGS = [
    ["school_name", "School name"], ["tagline", "Tagline"], ["about", "About the school", "textarea"], ["mission", "Mission", "textarea"],
    ["principal_name", "Principal name"], ["principal_message", "Principal's message", "textarea"], ["address", "Address"], ["phone", "Phone"],
    ["email", "Public email"], ["whatsapp", "WhatsApp number (digits)"], ["facebook", "Facebook page URL"], ["hero_image_url", "Homepage banner image", "image"],
  ];
  const TABS = ["dashboard", ...Object.keys(ENT), "settings", "admins"];
  const TAB_LABEL = { dashboard: ["Dashboard", "📊"], settings: ["Site settings", "⚙️"], admins: ["Admins", "🔐"] };

  let me = null, current = "dashboard", mode = "login", badges = {};

  // ---------- Auth ----------
  const msg = (t, cls) => { const m = $("#loginMsg"); m.textContent = t || ""; m.className = "msg " + (cls || ""); };
  $("#toggleMode").onclick = () => {
    mode = mode === "login" ? "signup" : "login";
    $("#loginBtn").textContent = mode === "login" ? "Sign in" : "Create account";
    $("#toggleMode").textContent = mode === "login" ? "First time? Create the admin account" : "Have an account? Sign in";
    msg("");
  };
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault(); msg("");
    const email = $("#email").value.trim(), password = $("#password").value;
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return msg(error.message, "err");
      if (!data.session) return msg("Account created. Check your email to confirm, then sign in.", "ok");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return msg(error.message, "err");
    }
    boot();
  };
  $("#logoutBtn").onclick = async () => { await sb.auth.signOut(); location.reload(); };

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { $("#loginView").hidden = false; $("#appView").hidden = true; return; }
    const { data: prof } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!prof || prof.role !== "admin") {
      await sb.auth.signOut();
      $("#loginView").hidden = false; $("#appView").hidden = true;
      return msg("This account is not an administrator. Ask an existing admin to grant access.", "err");
    }
    me = prof;
    $("#loginView").hidden = true; $("#appView").hidden = false;
    $("#whoami").textContent = prof.email;
    await refreshBadges();
    buildTabs(); go(current);
  }

  // ---------- Navigation ----------
  async function refreshBadges() {
    badges = {};
    for (const [k, e] of Object.entries(ENT)) {
      if (!e.badge) continue;
      const { count } = await sb.from(e.table).select("id", { count: "exact", head: true }).eq(e.badge.col, e.badge.val);
      badges[k] = count || 0;
    }
  }
  function buildTabs() {
    $("#tabs").innerHTML = TABS.map((t) => {
      const [label, icon] = TAB_LABEL[t] || [ENT[t].label, ENT[t].icon];
      return `<button data-t="${t}" class="${t === current ? "on" : ""}"><span>${icon}</span>${label}${badges[t] ? `<span class="badge">${badges[t]}</span>` : ""}</button>`;
    }).join("");
  }
  $("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) { go(b.dataset.t); $(".side").classList.remove("open"); } };
  $("#sideBtn").onclick = () => $(".side").classList.toggle("open");
  $("#addBtn").onclick = () => openForm(ENT[current], null);

  async function go(tab) {
    current = tab;
    buildTabs();
    const [label] = TAB_LABEL[tab] || [ENT[tab].label];
    $("#pageTitle").textContent = label;
    $("#addBtn").hidden = !ENT[tab] || ENT[tab].noAdd;
    $("#view").innerHTML = `<div class="empty">Loading…</div>`;
    if (tab === "dashboard") return dashboard();
    if (tab === "settings") return settings();
    if (tab === "admins") return admins();
    return list(ENT[tab]);
  }

  // ---------- Dashboard ----------
  async function dashboard() {
    const keys = Object.keys(ENT);
    const counts = await Promise.all(keys.map((k) => sb.from(ENT[k].table).select("id", { count: "exact", head: true }).then((r) => r.count || 0)));
    $("#view").innerHTML = `<div class="cards">${keys.map((k, i) => `<div class="stat"><b>${counts[i]}</b>${ENT[k].icon} ${ENT[k].label}</div>`).join("")}</div>
      <div class="panel pad" style="margin-top:18px"><b>Quick tips</b><p class="muted">New applications: <b>${badges.applications || 0}</b> · Unread messages: <b>${badges.messages || 0}</b>.
      Use the left menu to edit news, events, programs, staff and the photo gallery. Changes appear on the website instantly.</p></div>`;
  }

  // ---------- List ----------
  async function list(E) {
    const { data, error } = await sb.from(E.table).select("*").order(E.order[0], { ascending: E.order[1] });
    if (error) return ($("#view").innerHTML = `<div class="panel empty">Error: ${esc(error.message)}</div>`);
    if (!data.length) return ($("#view").innerHTML = `<div class="panel empty">Nothing here yet.</div>`);
    const head = E.cols.map(([k]) => `<th>${esc(k.replace(/_/g, " "))}</th>`).join("") + "<th></th>";
    const rows = data.map((r) => `<tr>${E.cols.map(([k, t]) => `<td>${cell(r[k], t)}</td>`).join("")}
      <td class="actions"><button class="btn sm light" data-edit="${r.id}">${E.noAdd ? "Open" : "Edit"}</button> <button class="btn sm danger" data-del="${r.id}">Delete</button></td></tr>`).join("");
    $("#view").innerHTML = `<div class="panel"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    $("#view").onclick = async (e) => {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
      if (ed) openForm(E, data.find((x) => x.id === ed.dataset.edit));
      if (dl && confirm("Delete this item permanently?")) {
        const { error } = await sb.from(E.table).delete().eq("id", dl.dataset.del);
        if (error) return toast(error.message);
        toast("Deleted"); await refreshBadges(); go(current);
      }
    };
  }
  function cell(v, t) {
    if (t === "img") return safeUrl(v) ? `<img class="thumb" src="${esc(safeUrl(v))}" alt="">` : "—";
    if (t === "bool") return `<span class="tag ${v ? "on" : "off"}">${v ? "Visible" : "Hidden"}</span>`;
    if (t === "read") return `<span class="tag ${v ? "off" : "new"}">${v ? "Read" : "Unread"}</span>`;
    if (t === "status") return `<span class="tag ${esc(v)}">${esc(v)}</span>`;
    if (t === "date") return esc(fmtD(v));
    if (t === "datetime") return esc(fmt(v));
    return esc(v ?? "");
  }

  // ---------- Form modal ----------
  const toLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  function fieldHtml(f, v) {
    const dis = f.ro ? "disabled" : "";
    const req = f.req ? "required" : "";
    const id = `f_${f.k}`;
    if (f.t === "textarea") return `<label>${f.l}<textarea id="${id}" rows="${f.rows || 3}" ${dis} ${req}>${esc(v ?? "")}</textarea></label>`;
    if (f.t === "checkbox") return `<label><input type="checkbox" id="${id}" ${v ?? f.def ? "checked" : ""}>${f.l}</label>`;
    if (f.t === "select") return `<label>${f.l}<select id="${id}">${f.opts.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
    if (f.t === "datetime") return `<label>${f.l}<input type="datetime-local" id="${id}" value="${toLocal(v || new Date().toISOString())}" ${req}></label>`;
    if (f.t === "number") return `<label>${f.l}<input type="number" id="${id}" value="${esc(v ?? f.def ?? 0)}"></label>`;
    if (f.t === "image") return `<label class="imgfield">${f.l}<input type="url" id="${id}" value="${esc(v ?? "")}" placeholder="https://… or upload below" ${req}>
      <input type="file" accept="image/*" data-up="${id}"><img class="preview" ${safeUrl(v) ? `src="${esc(safeUrl(v))}"` : "hidden"} alt=""></label>`;
    return `<label>${f.l}<input id="${id}" value="${esc(v ?? f.def ?? "")}" ${dis} ${req}></label>`;
  }
  function openForm(E, row) {
    $("#modalTitle").textContent = (row ? "Edit " : "New ") + E.label.toLowerCase();
    $("#modalForm").innerHTML = E.fields.map((f) => fieldHtml(f, row ? row[f.k] : undefined)).join("") +
      `<div class="msg err" id="formErr"></div><div class="form-actions"><button type="button" class="btn light" id="cancelBtn">Cancel</button><button class="btn" type="submit">Save</button></div>`;
    $("#modal").hidden = false;
    $("#cancelBtn").onclick = closeModal;
    wireUploads($("#modalForm"));
    $("#modalForm").onsubmit = async (e) => {
      e.preventDefault();
      const out = {};
      for (const f of E.fields) {
        if (f.ro) continue;
        const el = $("#f_" + f.k);
        if (f.t === "checkbox") out[f.k] = el.checked;
        else if (f.t === "number") out[f.k] = parseInt(el.value || "0", 10);
        else if (f.t === "datetime") out[f.k] = el.value ? new Date(el.value).toISOString() : null;
        else out[f.k] = el.value.trim();
      }
      const q = row ? sb.from(E.table).update(out).eq("id", row.id) : sb.from(E.table).insert(out);
      const { error } = await q;
      if (error) return ($("#formErr").textContent = error.message);
      closeModal(); toast("Saved"); await refreshBadges(); go(current);
    };
  }
  function closeModal() { $("#modal").hidden = true; }
  $("#modalClose").onclick = closeModal;
  $("#modal").addEventListener("mousedown", (e) => { if (e.target.id === "modal") closeModal(); });

  function wireUploads(root) {
    root.querySelectorAll("input[type=file][data-up]").forEach((inp) => {
      inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5 MB"); inp.value = ""; return; }
        toast("Uploading…");
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (error) { toast("Upload failed: " + error.message); return; }
        const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
        const target = $("#" + inp.dataset.up);
        target.value = data.publicUrl;
        const pv = inp.parentElement.querySelector(".preview");
        pv.src = data.publicUrl; pv.hidden = false;
        toast("Uploaded");
      };
    });
  }

  // ---------- Settings ----------
  async function settings() {
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
    const s = data || {};
    $("#view").innerHTML = `<form id="setForm" class="panel pad"><div class="settings-grid">${SETTINGS.map(([k, l, t]) => {
      const full = t ? "full" : "";
      if (t === "textarea") return `<div class="${full}"><label>${l}<textarea id="s_${k}" rows="3">${esc(s[k] ?? "")}</textarea></label></div>`;
      if (t === "image") return `<div class="${full}">${fieldHtml({ k: "s_" + k, l, t: "image" }, s[k])}</div>`;
      return `<div><label>${l}<input id="s_${k}" value="${esc(s[k] ?? "")}"></label></div>`;
    }).join("")}</div><div class="form-actions"><button class="btn" type="submit">Save settings</button></div></form>`;
    wireUploads($("#setForm"));
    $("#setForm").onsubmit = async (e) => {
      e.preventDefault();
      const out = { id: 1, updated_at: new Date().toISOString() };
      for (const [k, , t] of SETTINGS) out[k] = (t === "image" ? $("#f_s_" + k) : $("#s_" + k)).value.trim();
      const { error } = await sb.from("site_settings").upsert(out);
      toast(error ? error.message : "Settings saved");
    };
  }

  // ---------- Admins ----------
  async function admins() {
    const { data, error } = await sb.from("profiles").select("*").order("created_at");
    if (error) return ($("#view").innerHTML = `<div class="panel empty">${esc(error.message)}</div>`);
    $("#view").innerHTML = `<p class="muted">Anyone who creates an account is a normal user until you promote them here. Tip: after your admin account exists, turn off public sign-ups in Supabase (Authentication → Sign In / Providers).</p>
      <div class="panel"><table><thead><tr><th>Email</th><th>Joined</th><th>Role</th></tr></thead><tbody>${data.map((p) => `<tr><td>${esc(p.email)}</td><td>${esc(fmtD(p.created_at))}</td>
      <td><select data-role="${p.id}" ${p.id === me.id ? "disabled" : ""} style="width:auto;margin:0"><option ${p.role === "user" ? "selected" : ""}>user</option><option ${p.role === "admin" ? "selected" : ""}>admin</option></select></td></tr>`).join("")}</tbody></table></div>`;
    $("#view").onchange = async (e) => {
      const el = e.target.closest("[data-role]"); if (!el) return;
      const { error } = await sb.from("profiles").update({ role: el.value }).eq("id", el.dataset.role);
      toast(error ? error.message : "Role updated");
    };
  }

  boot();
})();
