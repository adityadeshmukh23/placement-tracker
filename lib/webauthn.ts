const CREDENTIAL_ID_KEY = "bhadebook:webauthn-credential-id";
const PROMPT_DISMISSED_KEY = "bhadebook:biometric-prompt-dismissed";

const RP_NAME = "Rental Book";
const USER_ID = new TextEncoder().encode("bhadebook-household");
const USER_NAME = "household";

/**
 * Biometric unlock is a purely local, per-device convenience layer on top of
 * the app's existing shared-PIN trust model — not a server-verified WebAuthn
 * ceremony (there is no backend to hold a public key or verify a signature).
 * A successful platform-authenticator assertion is treated as proof "the
 * correct biometric was presented on this exact device," which is used to
 * skip re-entering the already-known PIN (see PinGate) or to satisfy the
 * sensitive-document re-confirmation step directly (see SensitivePinModal).
 */

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function randomChallenge(): ArrayBuffer {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

function webAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!webAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasBiometricRegistered(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(CREDENTIAL_ID_KEY) !== null;
}

export function wasEnablePromptDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
}

export function dismissEnablePrompt(): void {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(PROMPT_DISMISSED_KEY, "1");
}

export async function registerBiometric(): Promise<{ error: string | null }> {
  if (!webAuthnSupported()) return { error: "not-supported" };
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: RP_NAME },
        user: { id: USER_ID, name: USER_NAME, displayName: "Household" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return { error: "no-credential" };
    localStorage.setItem(CREDENTIAL_ID_KEY, credential.id);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "failed" };
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  if (!webAuthnSupported()) return false;
  const credentialId = localStorage.getItem(CREDENTIAL_ID_KEY);
  if (!credentialId) return false;

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [
          { id: base64urlToBuffer(credentialId), type: "public-key" },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return assertion != null;
  } catch {
    return false;
  }
}

export function clearBiometric(): void {
  if (typeof localStorage !== "undefined")
    localStorage.removeItem(CREDENTIAL_ID_KEY);
}
