// account-page.js
(() => {
  const VS = window.VStore;
  const $ = (id) => document.getElementById(id);
  const say = (el, text, ok) => { el.textContent = text; el.className = `form-msg ${ok ? "success" : "error"}`; };

  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await VS.online)) {
      document.querySelector("main").innerHTML = `<div class="empty"><h2>Accounts need the V-STORE server</h2>
        <p>Start it with <code>npm run dev</code>. You can still shop and check out as a guest.</p>
        <a class="btn-primary" href="index.html">Keep shopping</a></div>`;
      return;
    }
    if (!VS.auth.requireLogin("Sign in to see your account.")) return;
    const user = (await VS.auth.refresh()) || VS.auth.user;
    if (!user) return VS.auth.requireLogin("Your session expired — sign in again.");
    fill(user);
  });

  function fill(u) {
    $("acct-hello").textContent = `Hi, ${u.name.split(" ")[0]}`;
    $("acct-email").textContent = `${u.email} · member since ${VS.fmtDate(u.createdAt)}`;
    $("p-name").value = u.name || ""; $("p-phone").value = u.phone || "";
    const a = u.address || {};
    $("p-line1").value = a.line1 || ""; $("p-city").value = a.city || ""; $("p-postcode").value = a.postcode || "";
    $("p-state").value = a.state || ""; $("p-country").value = a.country || "";
    if (u.role === "admin") $("acct-admin-link").innerHTML = '· <a href="admin.html">Store admin</a>';
  }

  $("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("profile-msg");
    if ($("p-name").value.trim().length < 2) return say(msg, "Enter your full name.");
    try {
      const { user } = await VS.api.put("/auth/me", {
        name: $("p-name").value.trim(), phone: $("p-phone").value.trim(),
        address: { line1: $("p-line1").value.trim(), city: $("p-city").value.trim(), postcode: $("p-postcode").value.trim(),
          state: $("p-state").value.trim(), country: $("p-country").value.trim() }
      });
      VS.auth.save({ user }, !!localStorage.getItem("vstore_token"));
      fill(user);
      say(msg, "Changes saved. Checkout will use this address.", true);
    } catch (err) { say(msg, err.message); }
  });

  $("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("password-msg");
    const currentPassword = $("pw-current").value, newPassword = $("pw-new").value;
    if (!currentPassword) return say(msg, "Enter your current password.");
    if (newPassword.length < 8) return say(msg, "New password must be at least 8 characters.");
    try {
      await VS.api.put("/auth/password", { currentPassword, newPassword });
      e.target.reset();
      say(msg, "Password updated.", true);
    } catch (err) { say(msg, err.message); }
  });

  $("logout-btn").addEventListener("click", () => VS.auth.logout("index.html"));
})();
