const COOKIE_NAME = "eac_admin_auth";

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export function getCookieName() {
  return COOKIE_NAME;
}

export async function signAdminToken({ username, expiresInSeconds }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  const exp = Math.floor(Date.now() / 1000) + (expiresInSeconds || 60 * 60 * 24 * 7);
  const payloadObj = { u: username, exp };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sigBytes = await hmacSha256(secret, payload);
  const sig = base64UrlEncode(sigBytes);
  return payload + "." + sig;
}

export async function verifyAdminToken(token) {
  try {
    if (!token || typeof token !== "string") return { ok: false };
    const parts = token.split(".");
    if (parts.length !== 2) return { ok: false };
    const [payload, sig] = parts;
    const secret = process.env.AUTH_SECRET;
    if (!secret) return { ok: false };

    const expectedSig = await hmacSha256(secret, payload);
    const providedSigBytes = base64UrlDecodeToBytes(sig);
    const sameLength = expectedSig.length === providedSigBytes.length;
    if (!sameLength) return { ok: false };
    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) diff |= expectedSig[i] ^ providedSigBytes[i];
    if (diff !== 0) return { ok: false };

    const payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payload));
    const obj = JSON.parse(payloadJson);
    if (!obj || typeof obj !== "object") return { ok: false };
    if (!obj.exp || typeof obj.exp !== "number") return { ok: false };
    if (obj.exp < Math.floor(Date.now() / 1000)) return { ok: false };
    return { ok: true, username: String(obj.u || "") };
  } catch {
    return { ok: false };
  }
}

