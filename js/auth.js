/* ============================================================
   Shared auth helpers — built on top of supabase-client.js
   ============================================================ */

// Where your site actually lives. Update this if your domain changes.
const SITE_URL = "https://bestpenagency.vercel.app";

// ---- Small utility: guarantees a minimum perceived loading time
// so transitions never feel like an instant, flat static page.
function withMinDelay(promise, ms = 2000) {
  const delay = new Promise((resolve) => setTimeout(resolve, ms));
  return Promise.all([promise, delay]).then(([result]) => result);
}

// ---- Loader overlay controls ----
function showLoader(text = "Loading...") {
  let overlay = document.getElementById("global-loader");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "global-loader";
    overlay.className = "loader-overlay";
    overlay.innerHTML = `
      <div class="loader-ring"></div>
      <div class="loader-text">${text}</div>
      <div class="loader-bar"><div class="loader-bar-fill"></div></div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector(".loader-text").textContent = text;
  }
  requestAnimationFrame(() => overlay.classList.add("show"));
}

function hideLoader() {
  const overlay = document.getElementById("global-loader");
  if (overlay) overlay.classList.remove("show");
}

// ---- Banner helper (inline error/success messages on forms) ----
function showBanner(el, message, type = "error") {
  el.textContent = message;
  el.className = `banner show banner-${type}`;
}
function hideBanner(el) {
  el.className = "banner";
}

// ---- Auth actions ----

async function registerUser({ name, email, password, referredByCode }) {
  return supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        referred_by_code: referredByCode ? referredByCode.trim().toUpperCase() : null,
      },
      emailRedirectTo: `${SITE_URL}/confirmed`,
    },
  });
}

async function loginUser({ email, password }) {
  return supabaseClient.auth.signInWithPassword({ email, password });
}

async function sendPasswordReset(email) {
  return supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/reset-password`,
  });
}

async function setNewPassword(newPassword) {
  return supabaseClient.auth.updateUser({ password: newPassword });
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) return null;
  return data.user;
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.href = "/login";
}

// ---- Dashboard gate ----
// Call this at the top of dashboard.html. Redirects to /login
// immediately if there's no valid, confirmed session.
async function requireAuthOrRedirect() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "/login";
    return null;
  }
  return data.session;
}

// ---- Referral system ----

// Call on any page a referral link could land on (influenzar, home, etc).
// Reads ?ref=CODE from the URL and remembers it so /register can pick it
// up later, even if the visitor browses around first.
function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) {
    localStorage.setItem("bestpen_ref_code", ref.trim().toUpperCase());
  }
}

function getStoredReferralCode() {
  return localStorage.getItem("bestpen_ref_code") || "";
}

// Checks whether a referral code actually belongs to a real user.
// Queries the public "referral_lookup" view (exposes ONLY the code
// column — never names or emails — see the Supabase schema file).
async function checkReferralCode(code) {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { checked: false };

  const { data, error } = await supabaseClient
    .from("referral_lookup")
    .select("referral_code")
    .eq("referral_code", clean)
    .maybeSingle();

  if (error) return { checked: true, valid: false, error: true };
  return { checked: true, valid: !!data };
}

// ---- Site-wide "cool loading" nav intercept ----
// Any plain <a href="/somewhere"> link (internal page, not a same-page
// "#" anchor, not external, not a new tab) pauses for 2s behind a thin
// top progress bar before actually navigating — no destination text,
// just a quick "something is happening" beat so nothing feels instant.
function showTopBar() {
  let bar = document.getElementById("top-progress-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "top-progress-bar";
    bar.className = "top-progress-bar";
    bar.innerHTML = '<div class="top-progress-fill"></div>';
    document.body.appendChild(bar);
  }
  requestAnimationFrame(() => bar.classList.add("show"));
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      link.target === "_blank" ||
      link.hasAttribute("data-no-loader")
    ) {
      return;
    }

    link.addEventListener("click", (e) => {
      e.preventDefault();
      showTopBar();
      setTimeout(() => {
        window.location.href = href;
      }, 2000);
    });
  });
});
