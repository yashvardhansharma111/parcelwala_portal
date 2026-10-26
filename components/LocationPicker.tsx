"use client";

/**
 * Pick a place: search for it, then put the pin exactly where the door is.
 *
 * Three fields come out of this, and they do different jobs:
 *
 *   address  — free text, what the captain reads. Stays editable, because
 *              "Shop 4, blue shutter, behind the mandi gate" is worth more to a
 *              rider than anything Google would format.
 *   lat/lon  — the pin. This is what GPS is compared against, so it decides
 *              whether a captain is excused the pickup OTP at this location.
 *   city     — which rate card prices the order.
 *
 * Dragging the pin changes the coordinates and never rewrites the address text.
 * The reverse-geocoded line is shown underneath as a check, not pasted over
 * careful directions someone just typed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addressAt,
  loadGoogleMaps,
  mapsConfigured,
  placeDetails,
  searchAddress,
  type Suggestion,
} from "@/lib/maps";
import { Field, inputCls } from "@/components/ui";

export type PickedLocation = {
  address: string;
  lat: number | null;
  lon: number | null;
  city: string;
};

export function LocationPicker({
  label,
  hint,
  value,
  onChange,
  /** Where to centre the map before anything is picked. */
  fallbackCity,
  rows = 2,
}: {
  label: string;
  hint?: string;
  value: PickedLocation;
  onChange: (v: PickedLocation) => void;
  fallbackCity?: string;
  rows?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [pinAddress, setPinAddress] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // ── search ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    // Debounced: Places is billed per request, and a keystroke is not a search.
    const t = setTimeout(async () => {
      const list = await searchAddress(q);
      setResults(list);
      setOpen(true);
      setSearching(false);
    }, 350);
    return () => {
      clearTimeout(t);
      setSearching(false);
    };
  }, [query]);

  const choose = async (s: Suggestion) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    const place = await placeDetails(s.placeId);
    if (!place) {
      // Still give them the text. A pinless address is worse than nothing only
      // if it pretends to have a pin, and it does not.
      onChange({ ...value, address: s.displayName });
      return;
    }
    setPinAddress(place.address);
    onChange({
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      city: place.city || value.city || fallbackCity || "",
    });
  };

  // ── map ───────────────────────────────────────────────────────────────────

  const movePin = useCallback(
    async (lat: number, lon: number) => {
      onChange({ ...value, lat, lon });
      const text = await addressAt(lat, lon);
      setPinAddress(text);
    },
    [onChange, value]
  );

  // Kept in a ref so the map's dragend listener, which is attached once, always
  // calls the current version rather than the one from its first render.
  const movePinRef = useRef(movePin);
  useEffect(() => {
    movePinRef.current = movePin;
  }, [movePin]);

  const hasPin = typeof value.lat === "number" && typeof value.lon === "number";

  useEffect(() => {
    if (!hasPin || !mapEl.current || !mapsConfigured) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapEl.current) return;
        const pos = { lat: value.lat as number, lng: value.lon as number };

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapEl.current, {
            center: pos,
            zoom: 17,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
          });
          markerRef.current = new google.maps.Marker({
            position: pos,
            map: mapRef.current,
            draggable: true,
          });
          markerRef.current.addListener("dragend", (e: any) => {
            const p = e.latLng;
            if (p) movePinRef.current(p.lat(), p.lng());
          });
          // Tapping the map is the same gesture as dragging, on a phone.
          mapRef.current.addListener("click", (e: any) => {
            const p = e.latLng;
            if (!p) return;
            markerRef.current?.setPosition(p);
            movePinRef.current(p.lat(), p.lng());
          });
        } else {
          markerRef.current?.setPosition(pos);
          mapRef.current.panTo(pos);
        }
      })
      .catch((e) => {
        if (!cancelled) setMapError(e instanceof Error ? e.message : "Maps unavailable");
      });

    return () => {
      cancelled = true;
    };
    // value.lat/lon drive re-centring; the rest of `value` must not re-run this,
    // which is why the pin mover is reached through a ref instead of the deps.
  }, [hasPin, value.lat, value.lon]);

  return (
    <div className="space-y-3">
      {/* search */}
      <div className="relative">
        <Field label={`Search for the ${label.toLowerCase()}`} hint={hint}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Shop name, street or landmark"
            className={inputCls}
            autoComplete="off"
          />
        </Field>

        {searching && query.trim().length >= 3 ? (
          <p className="mt-1 text-xs text-faint">Searching…</p>
        ) : null}

        {open && results.length > 0 ? (
          <>
            {/* Tapping anywhere else closes the list. */}
            <button
              type="button"
              aria-label="Close suggestions"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white shadow-lg">
              {results.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    className="block w-full px-3 py-2.5 text-left text-sm text-ink transition hover:bg-surface"
                  >
                    {s.displayName}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {open && !searching && query.trim().length >= 3 && results.length === 0 ? (
          <p className="mt-1 text-xs text-muted">
            Nothing found. Type the address below instead and move the pin.
          </p>
        ) : null}
      </div>

      {/* the address the captain reads */}
      <Field
        label={`${label} address`}
        hint="This is what the captain sees. Add the landmark or floor if it helps."
      >
        <textarea
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          rows={rows}
          placeholder="House / shop, street, landmark"
          className={inputCls}
        />
      </Field>

      {/* the pin */}
      {hasPin && mapsConfigured && !mapError ? (
        <div>
          <div
            ref={mapEl}
            className="h-52 w-full overflow-hidden rounded-xl border border-line bg-surface"
          />
          <p className="mt-1.5 text-xs text-muted">
            Drag the pin to the exact door. A captain who reaches this pin does not
            have to ask for a pickup code.
          </p>
          {pinAddress ? (
            <p className="mt-1 text-xs text-faint">Pin is at: {pinAddress}</p>
          ) : null}
        </div>
      ) : hasPin && mapError ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
          The map could not load ({mapError}), but the location is pinned from your
          search and the order will use it.
        </p>
      ) : !hasPin ? (
        <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted">
          No pin yet. Search above to place one — without it we cannot tell when a
          captain has reached this address, so they will always be asked for a
          pickup code.
        </p>
      ) : null}
    </div>
  );
}
