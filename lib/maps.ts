/**
 * Google Maps in the portal.
 *
 * Two halves, deliberately:
 *
 *  - **Searching for an address** goes through the backend (`/map/autocomplete`,
 *    `/map/place-details`). Those endpoints already exist and already hold the
 *    key, so the portal gets Places without shipping a credential to every
 *    shop counter running this page.
 *
 *  - **Showing and dragging the pin** needs the Maps JavaScript API, which runs
 *    in the browser and therefore needs a browser key. That is
 *    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 *
 * The pin is not decoration. A captain is excused the pickup OTP when GPS puts
 * them within 100 m of it, so a pin dropped on the wrong side of the market
 * makes every captain enter a code they should not need — and a pin that is too
 * generous lets one skip it from across the road. Letting the shop place its own
 * pin is what makes that check mean anything.
 *
 * Restrict this key to HTTP referrers for the portal's domains and to the Maps
 * JavaScript API. An unrestricted key in a public page is billable by anyone who
 * views the page source.
 */

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const mapsConfigured = Boolean(MAPS_KEY);

let mapsPromise: Promise<any> | null = null;

/** Loads the Maps JS API once per page, however many pickers ask for it. */
export function loadGoogleMaps(): Promise<any> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Maps can only load in the browser"));
      return;
    }
    const w = window as any;
    if (w.google?.maps) {
      resolve(w.google);
      return;
    }
    if (!MAPS_KEY) {
      mapsPromise = null;
      reject(
        new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set for this deployment")
      );
      return;
    }

    const callback = "__parcelwalahPortalMapsReady";
    w[callback] = () => resolve(w.google);
    const s = document.createElement("script");
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}` +
      `&v=weekly&loading=async&callback=${callback}`;
    s.async = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("Could not load Google Maps"));
    };
    document.head.appendChild(s);
  });

  return mapsPromise;
}

// ── address search, through the backend ──────────────────────────────────────

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "https://parcelwalah.in";

export type Suggestion = {
  displayName: string;
  placeId: string;
};

export type Place = {
  address: string;
  lat: number;
  lon: number;
  city?: string;
};

/**
 * Address suggestions. Returns an empty list on any failure rather than
 * throwing: a search box that goes quiet is recoverable by typing, and the
 * screen always offers the address field as a plain text input underneath.
 */
export async function searchAddress(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(`${BASE}/map/autocomplete?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    });
    const body = await res.json();
    const list = body?.data?.suggestions ?? [];
    return list
      .filter((s: any) => s?.placeId && s?.displayName)
      .map((s: any) => ({ displayName: String(s.displayName), placeId: String(s.placeId) }));
  } catch {
    return [];
  }
}

/** Turns a chosen suggestion into coordinates. */
export async function placeDetails(placeId: string): Promise<Place | null> {
  try {
    const res = await fetch(`${BASE}/map/place-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
      cache: "no-store",
    });
    const body = await res.json();
    const s = body?.data?.suggestion;
    const c = s?.coordinates;
    if (!s || typeof c?.lat !== "number" || typeof c?.lon !== "number") return null;
    return {
      address: String(s.displayName || ""),
      lat: c.lat,
      lon: c.lon,
      city: s.address?.city ? String(s.address.city) : undefined,
    };
  } catch {
    return null;
  }
}

/** The address at a point, for when the pin is dragged. */
export async function addressAt(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/map/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
      cache: "no-store",
    });
    const body = await res.json();
    // /map/details answers with { address: { address, city, ... } } — the inner
    // `address` is the formatted line.
    const text = body?.data?.address?.address;
    return text ? String(text) : null;
  } catch {
    return null;
  }
}
