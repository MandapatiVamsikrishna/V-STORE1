// contact-page.js
(() => {
  const VS = window.VStore;
  const $ = (id) => document.getElementById(id);
  const topic = (VS.qs("topic") || "").toLowerCase();
  const opt = [...$("c-subject").options].find((o) => o.value.toLowerCase() === topic);
  if (opt) opt.selected = true;
  const u = VS.auth.user;
  if (u) { $("c-name").value = u.name || ""; $("c-email").value = u.email || ""; }

  $("contact-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("contact-msg");
    const say = (t, ok) => { msg.textContent = t; msg.className = `form-msg ${ok ? "success" : "error"}`; };
    const body = { name: $("c-name").value.trim(), email: $("c-email").value.trim(), subject: $("c-subject").value, message: $("c-message").value.trim() };
    if (body.name.length < 2) return say("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return say("Enter a valid email address.");
    if (body.message.length < 10) return say("Your message should be at least 10 characters.");
    if (!(await VS.online)) return say("Messages need the V-STORE server running. You can also email support@vstore.example.");
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const r = await VS.api.post("/contact", body);
      $("c-message").value = "";
      say(r.message, true);
    } catch (err) { say(err.message); }
    finally { if (btn) btn.disabled = false; }
  });
})();
