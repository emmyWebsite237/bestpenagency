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
  captureReferralFromUrl();
});

// Event delegation (not per-element listeners) so this also covers links
// injected later by JS — like the drawer menu, which loads after auth checks.
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");
  if (!link) return;
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
  e.preventDefault();
  showTopBar();
  setTimeout(() => {
    window.location.href = href;
  }, 2000);
});

// ---- Profile helpers ----

async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function updateProfile(userId, fields) {
  return supabaseClient.from("profiles").update(fields).eq("id", userId);
}

// ---- Shared page init for every gated app page other than dashboard.html ----
// Confirms a real session, loads the profile, forces incomplete onboarding
// back to /dashboard (where the wizard lives), then mounts the shared chrome
// and hands control back to the page via onReady(user, profile).
async function initGatedPage(activeKey, onReady) {
  showLoader("Loading...");

  const session = await withMinDelay(requireAuthOrRedirect());
  if (!session) return;

  const user = await getCurrentUser();
  const profile = await getProfile(user.id);

  if (!profile || !profile.onboarding_completed) {
    window.location.href = "/dashboard";
    return;
  }

  const name = profile.username || profile.name || (user.user_metadata && user.user_metadata.name) || "there";

  mountAppChrome({ activeKey, name, avatarUrl: profile.avatar_url });

  hideLoader();
  document.getElementById("app-shell").style.display = "block";

  if (onReady) onReady(user, profile);
}
// Used by every gated app page (dashboard, referrals, earnings, payouts,
// leaderboard, rewards, settings, profile) so the nav is identical everywhere,
// on both mobile and desktop — no left sidebar, one unified top nav.

const APP_NAV_ITEMS = [
  { href: "/dashboard", icon: "▦", label: "Overview", key: "dashboard" },
  { href: "/referrals", icon: "👤", label: "Referrals", key: "referrals" },
  { href: "/earnings", icon: "◎", label: "Earnings", key: "earnings" },
  { href: "/payouts", icon: "▭", label: "Payouts", key: "payouts" },
  { href: "/leaderboard", icon: "🏆", label: "Leaderboard", key: "leaderboard" },
  { href: "/rewards", icon: "🎁", label: "Rewards", key: "rewards" },
  { href: "/settings", icon: "⚙", label: "Settings", key: "settings" },
];

function avatarInnerHTML(name, avatarUrl) {
  if (avatarUrl) return `<img src="${avatarUrl}" alt="">`;
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return initial;
}

function mountAppChrome({ activeKey, name, avatarUrl }) {
  const topbar = document.getElementById("app-topbar-root");
  topbar.innerHTML = `
    <a href="/dashboard" class="brand" data-no-loader>
      <span class="brand-mark"><img src="images/logo.png" alt=""></span> Best Pen Agency
    </a>
    <div class="app-topbar-right">
      <div class="icon-btn">🔔</div>
      <div class="avatar-btn" id="app-avatar-btn">${avatarInnerHTML(name, avatarUrl)}</div>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.className = "app-drawer-overlay";
  overlay.id = "app-drawer-overlay";
  document.body.appendChild(overlay);

  const drawer = document.createElement("nav");
  drawer.className = "app-drawer";
  drawer.id = "app-drawer";
  drawer.innerHTML = `
    <div class="app-drawer-header">
      <div class="avatar-btn" style="width:44px;height:44px;">${avatarInnerHTML(name, avatarUrl)}</div>
      <div>
        <div class="name">${name || "Member"}</div>
        <div class="sub">View profile</div>
      </div>
    </div>
    <div class="app-drawer-nav">
      ${APP_NAV_ITEMS.map(item => `
        <a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">
          <span class="icon">${item.icon}</span> ${item.label}
        </a>
      `).join("")}
    </div>
    <button class="app-drawer-logout" id="drawer-logout-btn">
      <span class="icon">⏻</span> Log out
    </button>
  `;
  document.body.appendChild(drawer);

  document.getElementById("app-avatar-btn").addEventListener("click", () => {
    drawer.classList.add("active");
    overlay.classList.add("active");
  });
  overlay.addEventListener("click", () => {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  });
  // Clicking the drawer header ("View profile") goes to the profile page.
  drawer.querySelector(".app-drawer-header").style.cursor = "pointer";
  drawer.querySelector(".app-drawer-header").addEventListener("click", () => {
    window.location.href = "/profile";
  });

  document.getElementById("drawer-logout-btn").addEventListener("click", async () => {
    showLoader("Logging you out...");
    await withMinDelay(logoutUser());
  });
}
