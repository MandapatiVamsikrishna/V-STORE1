// login.js — sign-in page
(() => {
  const $ = (s) => document.querySelector(s);
  const form = $("#login-form");
  const msg = $("#login-message");
  const submit = form?.querySelector('[type="submit"]');
  const VS = window.VStore;
  const next = (() => {
    const n = VS.qs("next") || "index.html";
    return /^[\w\-./?=&%]+$/.test(n) && !n.startsWith("//") && !n.includes(":") ? n : "index.html"; // same-site only
  })();

  const year = $("#year"); if (year) year.textContent = new Date().getFullYear();

  // Already signed in? go straight on
  if (VS.auth.isLoggedIn()) { location.replace(next); return; }

  // Show / hide password
  $("#toggle-pass")?.addEventListener("click", (e) => {
    const input = $("#password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
    e.currentTarget.textContent = show ? "Hide" : "Show";
  });

  // Prefill email after registration
  const lastEmail = sessionStorage.getItem("vstore_last_email");
  if (lastEmail) $("#email").value = lastEmail;

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    msg.className = "login-message";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Enter a valid email address."; msg.classList.add("error"); return; }
    if (!password) { msg.textContent = "Enter your password."; msg.classList.add("error"); return; }

    if (!(await VS.online)) {
      msg.textContent = "Sign-in needs the V-STORE server. Start it with npm run dev, or keep shopping as a guest.";
      msg.classList.add("error");
      return;
    }

    submit.disabled = true; submit.textContent = "Signing in…"; msg.textContent = "";
    try {
      const user = await VS.auth.login(email, password, $("#remember")?.checked);
      msg.textContent = `Welcome back, ${user.name.split(" ")[0]}!`;
      msg.classList.add("success");
      setTimeout(() => location.replace(next), 400);
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add("error");
      submit.disabled = false; submit.textContent = "Sign in";
    }
  });
})();
