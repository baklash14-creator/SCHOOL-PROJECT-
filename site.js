(function () {
  const C = window.ZULAKIAI_CONFIG || {};
  const configured = C.SUPABASE_URL && !C.SUPABASE_URL.includes("YOUR-PROJECT") && C.SUPABASE_ANON_KEY && !C.SUPABASE_ANON_KEY.includes("YOUR-ANON");
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  $("#yr").textContent = new Date().getFullYear();
  $("#menuBtn").addEventListener("click", () => $("#menu").classList.toggle("open"));
  $("#menu").addEventListener("click", (e) => { if (e.target.tagName === "A") $("#menu").classList.remove("open"); });

  if (!configured) {
    $("#setupBanner").hidden = false;
    document.querySelectorAll(".empty").forEach((n) => (n.textContent = "Connect Supabase in config.js to show content."));
    return;
  }
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  async function loadSettings() {
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return;
    document.querySelectorAll("[data-s]").forEach((el) => {
      const v = data[el.dataset.s];
      if (v) el.textContent = v;
    });
    document.title = data.school_name || "Zulakiai School";
    const hero = $("#home");
    if (safeUrl(data.hero_image_url)) {
      hero.style.backgroundImage = `url("${safeUrl(data.hero_image_url)}")`;
      hero.classList.add("has-img");
    }
    const links = [];
    if (data.whatsapp) links.push(`<a href="https://wa.me/${esc(String(data.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>`);
    if (safeUrl(data.facebook)) links.push(`<a href="${esc(safeUrl(data.facebook))}" target="_blank" rel="noopener">Facebook</a>`);
    $("#socials").innerHTML = links.join(" · ");
  }

  function fill(sel, html, emptyMsg) {
    $(sel).innerHTML = html || `<p class="empty">${emptyMsg}</p>`;
  }

  async function loadPrograms() {
    const { data } = await sb.from("programs").select("*").order("sort_order");
    $("#statPrograms").textContent = (data || []).length;
    fill("#programsList", (data || []).map((p) => `
      <article class="card pad"><div class="icon">${esc(p.icon)}</div>
      <h3>${esc(p.title)}</h3>${p.level ? `<span class="pill">${esc(p.level)}</span>` : ""}
      <p>${esc(p.description)}</p></article>`).join(""), "Programs coming soon.");
  }

  async function loadNews() {
    const { data } = await sb.from("news").select("*").order("published_at", { ascending: false }).limit(9);
    fill("#newsList", (data || []).map((n) => `
      <article class="card">${safeUrl(n.image_url) ? `<img class="cover" loading="lazy" src="${esc(safeUrl(n.image_url))}" alt="">` : ""}
      <div class="pad"><div class="meta">${fmtDate(n.published_at)}</div><h3>${esc(n.title)}</h3>
      <p>${esc(n.summary || n.body)}</p></div></article>`).join(""), "No news yet.");
  }

  async function loadEvents() {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data } = await sb.from("events").select("*").gte("starts_at", since).order("starts_at").limit(9);
    $("#statEvents").textContent = (data || []).length;
    fill("#eventsList", (data || []).map((e) => {
      const d = new Date(e.starts_at);
      return `<article class="card event"><div class="date-box"><b>${d.getDate()}</b><span>${d.toLocaleString(undefined, { month: "short" })}</span></div>
      <div><h3>${esc(e.title)}</h3><div class="meta">${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}${e.location ? " · " + esc(e.location) : ""}</div>
      <p>${esc(e.description)}</p></div></article>`;
    }).join(""), "No upcoming events right now.");
  }

  async function loadStaff() {
    const { data } = await sb.from("staff").select("*").order("sort_order");
    $("#statStaff").textContent = (data || []).length;
    fill("#staffList", (data || []).map((s) => `
      <article class="card staff-card">${safeUrl(s.photo_url) ? `<img class="avatar" loading="lazy" src="${esc(safeUrl(s.photo_url))}" alt="${esc(s.full_name)}">` : `<div class="avatar">${esc((s.full_name || "?")[0])}</div>`}
      <div class="pad"><h3>${esc(s.full_name)}</h3><span class="pill">${esc(s.position)}</span><p>${esc(s.bio)}</p></div></article>`).join(""), "Staff profiles coming soon.");
  }

  async function loadGallery() {
    const { data } = await sb.from("gallery").select("*").order("created_at", { ascending: false }).limit(30);
    fill("#galleryList", (data || []).filter((g) => safeUrl(g.image_url)).map((g) => `
      <figure><img loading="lazy" src="${esc(safeUrl(g.image_url))}" alt="${esc(g.caption)}">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join(""), "Photos coming soon.");
  }

  $("#galleryList").addEventListener("click", (e) => {
    if (e.target.tagName !== "IMG") return;
    $("#lightbox img").src = e.target.src;
    $("#lightbox").classList.add("open");
  });
  $("#lightbox").addEventListener("click", () => $("#lightbox").classList.remove("open"));

  function note(sel, ok, msg) {
    const n = $(sel);
    n.className = "notice " + (ok ? "ok" : "err");
    n.textContent = msg;
  }

  $("#applyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const row = {
      student_name: $("#a_student").value.trim(),
      date_of_birth: $("#a_dob").value || null,
      grade_applying: $("#a_grade").value,
      previous_school: $("#a_prev").value.trim(),
      parent_name: $("#a_parent").value.trim(),
      parent_phone: $("#a_phone").value.trim(),
      parent_email: $("#a_email").value.trim(),
      address: $("#a_addr").value.trim(),
      notes: $("#a_notes").value.trim(),
    };
    const { error } = await sb.from("applications").insert(row);
    btn.disabled = false;
    if (error) return note("#applyNote", false, "Sorry, we could not submit your application. Please check the fields and try again.");
    e.target.reset();
    note("#applyNote", true, "Thank you! Your application was received. We will contact you soon.");
  });

  $("#contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const { error } = await sb.from("messages").insert({
      name: $("#c_name").value.trim(),
      email: $("#c_email").value.trim(),
      subject: $("#c_subject").value.trim(),
      message: $("#c_msg").value.trim(),
    });
    btn.disabled = false;
    if (error) return note("#contactNote", false, "Sorry, your message could not be sent. Please try again.");
    e.target.reset();
    note("#contactNote", true, "Message sent. Thank you!");
  });

  Promise.all([loadSettings(), loadPrograms(), loadNews(), loadEvents(), loadStaff(), loadGallery()]).catch(() => {
    $("#setupBanner").textContent = "Could not load content. Check config.js and that schema.sql has been run.";
    $("#setupBanner").hidden = false;
  });
})();
