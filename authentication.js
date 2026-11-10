// register.js — V-STORE registration page logic
(() => {
  const $ = (s, r=document) => r.querySelector(s);

  const form = $("#registrationForm");
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

  const setError = (el, errEl, text) => {
    if (!errEl) return;
    if (text) {
      errEl.textContent = text;
      el?.setAttribute("aria-invalid", "true");
    } else {
      errEl.textContent = "";
      el?.removeAttribute("aria-invalid");
    }
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
    strengthText.textContent = ["Very weak","Weak","Okay","Good","Strong"][score] || "Weak";
  }

  // Simple validators
  const isValidName = (v) => (v || "").trim().length >= 2;
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
  const isValidPhone = (v) => !v || /^\+?[0-9\s\-()]{7,}$/.test(v);
  const passwordsMatch = () => (passEl.value || "") === (pass2El.value || "");

  // Live validations
  nameEl.addEventListener("input", () => {
    setError(nameEl, nameErr, isValidName(nameEl.value) ? "" : "Please enter your full name.");
    toggleButton();
  });

  emailEl.addEventListener("input", async () => {
    const v = emailEl.value.trim();
    if (!isValidEmail(v)) {
      setError(emailEl, emailErr, "Enter a valid email address.");
      toggleButton();
      return;
    }
    setError(emailEl, emailErr, ""); // looks OK — now check availability
    try {
      const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(v)}`);
      const data = await r.json();
      if (data.taken) {
        setError(emailEl, emailErr, "This email is already registered.");
      } else {
        setError(emailEl, emailErr, "");
      }
    } catch {
      // network error — don’t block, just allow
      setError(emailEl, emailErr, "");
    }
    toggleButton();
  });

  passEl.addEventListener("input", () => {
    const pw = passEl.value;
    const score = scorePassword(pw);
    renderStrength(score);
    setError(passEl, passErr, pw.length >= 8 ? "" : "Password must be at least 8 characters.");
    // also update confirm check
    if (pass2El.value) {
      setError(pass2El, pass2Err, passwordsMatch() ? "" : "Passwords do not match.");
    }
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

  // Eye toggles
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-eye");
    if (!btn) return;
    const id = btn.getAttribute("data-eye-for");
    const target = document.getElementById(id);
    if (!target) return;
    const next = target.type === "password" ? "text" : "password";
    target.type = next;
    btn.setAttribute("aria-label", next === "text" ? "Hide password" : "Show password");
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
  }

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";

    // Final guard
    toggleButton();
    if (registerBtn.disabled) {
      msgEl.textContent = "Please fix the highlighted fields.";
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = "Creating account…";

    const payload = {
      name: nameEl.value.trim(),
      email: emailEl.value.trim().toLowerCase(),
      password: passEl.value,       // sent over HTTPS in real deployments
      phone: phoneEl.value.trim() || null
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.field === "email") setError(emailEl, emailErr, data.error || "Email not available.");
        msgEl.textContent = data.error || "Registration failed.";
        registerBtn.disabled = false;
        registerBtn.textContent = "Create account";
        return;
      }

      msgEl.textContent = "Account created! Redirecting to sign in…";
      // Optional: store a flash flag to show a toast on login page
      try { sessionStorage.setItem("flash", "registered"); } catch {}
      setTimeout(() => window.location.href = "login.html", 900);

    } catch (err) {
      msgEl.textContent = "Network error. Please try again.";
      registerBtn.disabled = false;
      registerBtn.textContent = "Create account";
    }
  });

  // Initial strength UI state
  renderStrength(0);
})();
