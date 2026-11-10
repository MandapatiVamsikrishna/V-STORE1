// login.js — V-STORE sign-in page (authentication.html)
// Uses window.vstoreAuth from store.js. Accounts are stored in this browser only.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const form = $("#login-form");
  if (!form) return;

  const emailEl = $("#email");
  const passEl = $("#password");
  const rememberEl = $("#remember");
  const msgEl = $("#login-message");
  const submitBtn = form.querySelector('button[type="submit"]');

  // Where to go after signing in (e.g. authentication.html?next=checkout.html)
  const next = (() => {
    const n = new URLSearchParams(location.search).get("next") || "";
    return /^[\w\- %.]+\.html(\?[\w=&%\-.]*)?$/.test(n) && !/^authentication\.html/.test(n) ? n : "index.html";
  })();

  const say = (text, ok) => {
    msgEl.textContent = text;
    msgEl.style.color = ok ? "#15803d" : "#dc2626";
  };

  // Already signed in?
  const me = window.vstoreAuth?.current();
  if (me) {
    msgEl.innerHTML = `You're signed in as <strong></strong>. <a class="link" href="account.html">Go to your account</a> or <a class="link" href="#" id="switch-user">sign out</a>.`;
    msgEl.querySelector("strong").textContent = me.email;
    msgEl.style.color = "";
    $("#switch-user")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.vstoreAuth.logout();
      msgEl.textContent = "Signed out. You can sign in with another account.";
    });
  }

  // Remember the last email used on this device
  try { emailEl.value ||= localStorage.getItem("vstore_last_email") || ""; } catch {}

  // Show / hide password
  $("#toggle-pass")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const show = passEl.type === "password";
    passEl.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    const icon = btn.querySelector("i");
    if (icon) icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    else btn.textContent = show ? "🙈" : "👁️";
  });
  // The eye button has no visible text if the icon font can't load
  const eye = $("#toggle-pass");
  if (eye && !eye.textContent.trim()) {
    const icon = eye.querySelector("i");
    setTimeout(() => { if (icon && icon.offsetWidth === 0) eye.textContent = "👁️"; }, 800);
  }

  // Google / Apple need a real server to work
  document.querySelectorAll(".btn-social").forEach((b) =>
    b.addEventListener("click", () => {
      say(`${b.dataset.provider || "Social"} sign-in needs a server, so it isn't available on this demo store. Please sign in with your email, or create an account.`, false);
    })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailEl.value.trim();
    const password = passEl.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Enter a valid email address.", false); emailEl.focus(); return; }
    if (!password) { say("Enter your password.", false); passEl.focus(); return; }
    if (!window.vstoreAuth?.users().length) {
      say("No accounts exist on this device yet. Create one first.", false);
      return;
    }
    submitBtn.disabled = true;
    try {
      const u = await window.vstoreAuth.login(email, password, rememberEl?.checked);
      try { localStorage.setItem("vstore_last_email", u.email); } catch {}
      say(`Welcome back, ${u.name.split(" ")[0]}! Taking you there…`, true);
      setTimeout(() => (location.href = next), 700);
    } catch (err) {
      say(err.message, false);
      passEl.select();
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
