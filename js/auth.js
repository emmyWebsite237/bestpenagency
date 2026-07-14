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

async function registerUser({ name, email, password }) {
  return supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { name }, // stored in user_metadata, no separate table needed
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
