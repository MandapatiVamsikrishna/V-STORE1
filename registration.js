// registration.js — V-STORE create-account page (registration.html)
// Same checks as before, but accounts are saved in this browser via window.vstoreAuth (store.js),
// so registration works on GitHub Pages without a server.
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  const form = $("#registrationForm");
  if (!form) return;
  const nameEl = $("#name");
  const emailEl = $("#email");
  const passEl = $("#password");
  const pass2El = $("#confirmPassword");
  const phoneEl = $("#phone");
  const termsEl = $("#terms");
  const registerBtn = $("#registerBtn");
  const msgEl = $("#formMessage");

  const nameErr = $("#nameError");
  const emailErr = $("#emailError");
  const passErr = $("#passwordError");
  const pass2Err = $("#confirmPasswordError");
  const phoneErr = $("#phoneError");
  const termsErr = $("#termsError");

  const strengthText = $("#passwordStrength");
  const bars = Array.from(document.querySelectorAll(".strength-bar"));

  const next = (() => {
    const n = new URLSearchParams(location.search).get("next") || "";
    return /^[\w\- %.]+\.html(\?[\w=&%\-.]*)?$/.test(n) && !/^(authentication|registration)\.html/.test(n) ? n : "account.html";
  })();

  const setError = (el, errEl, text) => {
    if (!errEl) return;
    errEl.textContent = text || "";
    if (text) el?.setAttribute("aria-invalid", "true");
    else el?.removeAttribute("aria-invalid");
  };

  // Password strength: 0-4
  function scorePassword(pw) {
    let score = 0;
    if (!pw) return 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(4, score);
  }
  function renderStrength(score) {
    bars.forEach((b, i) => b.classList.toggle("on", i < score));
    if (strengthText) strengthText.textContent = ["Very weak", "Weak", "Okay", "Good", "Strong"][score] || "Weak";
  }

  const isValidName = (v) => (v || "").trim().length >= 2;
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
  const isValidPhone = (v) => !v || /^\+?[0-9\s\-()]{7,}$/.test(v);
  const passwordsMatch = () => (passEl.value || "") === (pass2El.value || "");

  nameEl.addEventListener("input", () => {
    setError(nameEl, nameErr, isValidName(nameEl.value) ? "" : "Please enter your full name.");
    toggleButton();
  });

  emailEl.addEventListener("input", () => {
    const v = emailEl.value.trim();
    if (!isValidEmail(v)) setError(emailEl, emailErr, "Enter a valid email address.");
    else if (window.vstoreAuth?.find(v)) setError(emailEl, emailErr, "This email is already registered. Sign in instead.");
    else setError(emailEl, emailErr, "");
    toggleButton();
  });

  passEl.addEventListener("input", () => {
    renderStrength(scorePassword(passEl.value));
    setError(passEl, passErr, passEl.value.length >= 8 ? "" : "Password must be at least 8 characters.");
    if (pass2El.value) setError(pass2El, pass2Err, passwordsMatch() ? "" : "Passwords do not match.");
    toggleButton();
  });

  pass2El.addEventListener("input", () => {
    setError(pass2El, pass2Err, passwordsMatch() ? "" : "Passwords do not match.");
    toggleButton();
  });

  phoneEl.addEventListener("input", () => {
    setError(phoneEl, phoneErr, isValidPhone(phoneEl.value) ? "" : "Enter a valid phone number or leave empty.");
    toggleButton();
  });

  termsEl.addEventListener("change", () => {
    setError(termsEl, termsErr, termsEl.checked ? "" : "You must accept the terms.");
    toggleButton();
  });

  // Show / hide password buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-eye");
    if (!btn) return;
    const target = document.getElementById(btn.getAttribute("data-eye-for"));
    if (!target) return;
    const show = target.type === "password";
    target.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.textContent = show ? "🙈" : "👁️";
  });

  function toggleButton() {
    const ok =
      isValidName(nameEl.value) &&
      isValidEmail(emailEl.value) &&
      passEl.value.length >= 8 &&
      passwordsMatch() &&
      isValidPhone(phoneEl.value) &&
      termsEl.checked &&
      !emailErr.textContent && !nameErr.textContent && !passErr.textContent &&
      !pass2Err.textContent && !phoneErr.textContent && !termsErr.textContent;
    registerBtn.disabled = !ok;
    return ok;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";
    if (!toggleButton()) { msgEl.textContent = "Please fix the highlighted fields."; return; }

    registerBtn.disabled = true;
    registerBtn.textContent = "Creating account…";
    try {
      const user = await window.vstoreAuth.register({
        name: nameEl.value,
        email: emailEl.value,
        password: passEl.value,
        phone: phoneEl.value,
      });
      try { localStorage.setItem("vstore_last_email", user.email); } catch {}
      msgEl.textContent = `Account created — welcome, ${user.name.split(" ")[0]}! Taking you to your account…`;
      msgEl.style.color = "#15803d";
      setTimeout(() => (location.href = next), 900);
    } catch (err) {
      if (/email/i.test(err.message)) setError(emailEl, emailErr, err.message);
      msgEl.textContent = err.message;
      msgEl.style.color = "#dc2626";
      registerBtn.disabled = false;
      registerBtn.textContent = "Create account";
    }
  });

  // Signed in already? Offer the account page instead.
  const me = window.vstoreAuth?.current();
  if (me) msgEl.innerHTML = `You're already signed in as <strong>${me.email.replace(/[<>&]/g, "")}</strong>. <a href="account.html">Go to your account</a>.`;

  renderStrength(0);
})();
