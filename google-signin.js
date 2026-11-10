// google-signin.js — "Sign in with Google" for V-STORE (sign-in and register pages)
//
// Uses Google Identity Services (https://accounts.google.com/gsi/client), which works on a
// static site like GitHub Pages: Google shows its own button/pop-up, the person picks their
// Google account, and Google hands this page a signed ID token with their name, email and photo.
// We check the token is for THIS site's Client ID, from Google, and not expired, then sign the
// person in to their V-STORE account (created automatically the first time).
//
// Needs: config.js (Client ID), store.js (window.vstoreAuth). Elements: any [data-google-signin].
(() => {
  const CLIENT_ID = String(window.VSTORE_CONFIG?.googleClientId || "").trim();
  const slots = Array.from(document.querySelectorAll("[data-google-signin]"));
  if (!slots.length) return;

  const isSignup = document.body.dataset.page === "register" || /registration\.html$/i.test(location.pathname);
  const msgEl = document.querySelector("#login-message, #formMessage");
  const say = (text, ok) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.color = ok ? "#15803d" : "#dc2626";
  };

  // Where to go afterwards (same rules as the email sign-in)
  const next = (() => {
    const n = new URLSearchParams(location.search).get("next") || "";
    const ok = /^[\w\- %.]+\.html(\?[\w=&%\-.]*)?$/.test(n) && !/^(authentication|registration)\.html/.test(n);
    return ok ? n : isSignup ? "account.html" : "index.html";
  })();

  const fallbackButtons = () => slots.map((s) => s.querySelector(".btn-social")).filter(Boolean);

  if (!/\.apps\.googleusercontent\.com$/.test(CLIENT_ID)) {
    fallbackButtons().forEach((b) =>
      b.addEventListener("click", () =>
        say("Google sign-in isn't set up yet: the site owner needs to add a Google Client ID in config.js.", false)
      )
    );
    return;
  }

  // ---- load Google's library ----
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = init;
  script.onerror = () => {
    fallbackButtons().forEach((b) =>
      b.addEventListener("click", () => say("Couldn't reach Google. Check your internet connection (or ad blocker) and reload.", false))
    );
  };
  document.head.appendChild(script);

  function init() {
    if (!window.google?.accounts?.id) return script.onerror();
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: onCredential,
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
      context: isSignup ? "signup" : "signin",
      itp_support: true,
    });
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    slots.forEach((slot) => {
      const width = Math.max(220, Math.min(400, Math.round(slot.getBoundingClientRect().width) || 300));
      const host = document.createElement("div");
      host.className = "google-button-host";
      slot.replaceChildren(host);
      google.accounts.id.renderButton(host, {
        type: "standard",
        theme: dark ? "filled_black" : "outline",
        size: "large",
        text: isSignup ? "signup_with" : "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width,
      });
    });
  }

  // Decode the middle (payload) part of the ID token — base64url JSON, may contain non-ASCII names
  function decodeJwt(token) {
    const part = String(token || "").split(".")[1];
    if (!part) throw new Error("Google sent an empty sign-in response.");
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function onCredential(response) {
    try {
      const c = decodeJwt(response?.credential);
      const now = Date.now() / 1000;
      if (c.aud !== CLIENT_ID) throw new Error("This Google sign-in wasn't issued for V-STORE.");
      if (!["accounts.google.com", "https://accounts.google.com"].includes(c.iss)) throw new Error("This sign-in didn't come from Google.");
      if (!c.exp || c.exp < now) throw new Error("Your Google sign-in expired. Please try again.");
      if (!c.email || c.email_verified === false) throw new Error("Your Google account's email address isn't verified.");
      const user = window.vstoreAuth.loginWithGoogle({
        sub: c.sub,
        email: c.email,
        name: c.name || [c.given_name, c.family_name].filter(Boolean).join(" ") || c.email.split("@")[0],
        picture: c.picture || "",
      });
      try { localStorage.setItem("vstore_last_email", user.email); } catch {}
      say(`Welcome, ${String(user.name).split(" ")[0]}! Taking you there…`, true);
      setTimeout(() => (location.href = next), 700);
    } catch (err) {
      say(err.message || "Google sign-in failed. Please try again.", false);
    }
  }
})();
