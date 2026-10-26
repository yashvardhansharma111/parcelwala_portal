/**
 * Talking to the Parcelwalah backend.
 *
 * The portal holds no Firebase credentials and touches no collection directly.
 * Every read and write goes through the same API the apps use, so pricing, the
 * wallet transaction and dispatch all behave identically wherever an order came
 * from — and a partner can never be given a key that reaches another partner's
 * data.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "https://parcelwalah.in";

const TOKEN_KEY = "pw_partner_token";
const PARTNER_KEY = "pw_partner";

export type Partner = { id: string; name: string; email: string; city: string };

export const getToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export const getStoredPartner = (): Partner | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PARTNER_KEY);
    return raw ? (JSON.parse(raw) as Partner) : null;
  } catch {
    return null;
  }
};

export const storeSession = (token: string, partner: Partner) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PARTNER_KEY, JSON.stringify(partner));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PARTNER_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // A dead session is sent back to sign-in rather than left to surface as a
    // confusing permission error on whichever screen happened to be open.
    if (res.status === 401 && typeof window !== "undefined") {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign(new URL("/login", window.location.origin));
      }
    }
    throw new ApiError(
      body?.error?.message || body?.message || `Request failed (${res.status})`,
      res.status
    );
  }

  return (body?.data ?? body) as T;
}

// ── formatting ───────────────────────────────────────────────────────────────

/** Money is always whole rupees here — the rate card has no paise. */
export const inr = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Everything a partner sees is in their own time, not the server's. */
export const istDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const istDay = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
