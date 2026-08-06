/* ============================================================
   BestPenAgency — Referral tracking
   Include on every public page, after supabase-client.js.
   ============================================================ */

const REF_COOKIE_DAYS = 90; // how long a referral tag "sticks" to a device
const DEVICE_COOKIE_DAYS = 730; // device id persists much longer than any one referral

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function getOrCreateDeviceId() {
  let id = getCookie("bp_device");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    setCookie("bp_device", id, DEVICE_COOKIE_DAYS);
  }
  return id;
}

function getStoredReferralCode() {
  return getCookie("bp_ref");
}

// Call once on every page load. If ?ref=CODE is present, tags this
// device with it (first tap wins nothing yet — every tap just resets
// the 90-day window) and logs it to Supabase immediately, which is
// what makes the referrer's count go up the instant the link is tapped.
async function captureReferralFromUrl() {
  const deviceId = getOrCreateDeviceId();

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;

  const code = ref.trim().toUpperCase();
  setCookie("bp_ref", code, REF_COOKIE_DAYS);

  try {
    await supabaseClient.from("referral_taps").insert({
      referral_code: code,
      device_id: deviceId,
    });
    // A duplicate-key error here (same device tapping the same code
    // again) is expected and fine — it just means this device was
    // already counted, so nothing further happens.
  } catch (e) {
    // Silently ignore — referral tracking should never break the page.
  }
}

document.addEventListener("DOMContentLoaded", () => {
  getOrCreateDeviceId();
  captureReferralFromUrl();
});
