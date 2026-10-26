"use client";

/**
 * Place a delivery order.
 *
 * Two rules shape this screen:
 *
 * 1. The distance is measured, not guessed. It comes from Google via the
 *    backend, and the label always says where it came from. A typed number is
 *    allowed when Maps cannot answer, but it is marked as typed — the partner
 *    is billed on this figure, so pretending a guess was a measurement is how
 *    an invoice stops matching the quote.
 *
 * 2. Nothing is charged until the partner has seen the price. The fee, the slab
 *    it came from and the balance left after are all on screen before the
 *    confirm button does anything.
 *
 * Editing an address after measuring clears the measurement, because a distance
 * for the previous address is worse than no distance at all.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, getStoredPartner, inr } from "@/lib/api";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  SectionTitle,
  inputCls,
} from "@/components/ui";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  city: string;
  lat?: number | null;
  lon?: number | null;
  isDefault: boolean;
};

type DistanceResult =
  | { ok: true; distanceKm: number; durationMin: number | null; source: "maps" }
  | { ok: false; reason: string };

type Quote = {
  city: string;
  hasRateCard: boolean;
  walletBalance: number;
  ok: boolean;
  fee?: number;
  slabLabel?: string;
  reason?: string;
  balanceAfter: number;
  sufficient: boolean;
};

const NEW_PICKUP = "__new__";

export default function PlaceOrderPage() {
  const router = useRouter();
  const partner = getStoredPartner();

  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [pickupId, setPickupId] = useState<string>(NEW_PICKUP);
  const [pickup, setPickup] = useState<PickedLocation>({
    address: "",
    lat: null,
    lon: null,
    city: partner?.city ?? "",
  });
  const [drop, setDrop] = useState<PickedLocation>({
    address: "",
    lat: null,
    lon: null,
    city: partner?.city ?? "",
  });

  const [dropName, setDropName] = useState("");
  const [dropPhone, setDropPhone] = useState("");

  const [orderType, setOrderType] = useState<"standard" | "food">("standard");
  const [codAmount, setCodAmount] = useState("");
  const [note, setNote] = useState("");

  const [measured, setMeasured] = useState<
    { km: number; durationMin: number | null } | null
  >(null);
  const [manualKm, setManualKm] = useState("");
  const [mapsFailed, setMapsFailed] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // ── saved pickup locations ─────────────────────────────────────────────────

  useEffect(() => {
    apiRequest<{ addresses: SavedAddress[] }>("/partner/locations")
      .then(({ addresses }) => {
        setSaved(addresses);
        const def = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (def) {
          setPickupId(def.id);
          setPickup({
            address: def.address,
            lat: def.lat ?? null,
            lon: def.lon ?? null,
            city: def.city,
          });
        }
      })
      .catch(() => {
        // No saved locations is a normal state, not an error worth a banner.
      });
  }, []);

  const choosePickup = (id: string) => {
    setPickupId(id);
    if (id === NEW_PICKUP) {
      setPickup({ address: "", lat: null, lon: null, city: partner?.city ?? "" });
      return;
    }
    const a = saved.find((x) => x.id === id);
    // A saved location carries its own pin, which is the whole reason saving one
    // is worth doing: the shop placed it once and every order inherits it.
    if (a) {
      setPickup({
        address: a.address,
        lat: a.lat ?? null,
        lon: a.lon ?? null,
        city: a.city,
      });
    }
  };

  // ── distance ──────────────────────────────────────────────────────────────

  // A measurement belongs to the pair of addresses it was taken for. Changing
  // either one throws it away rather than quietly repricing the new route at
  // the old distance.
  const addressKey = [
    pickup.address,
    pickup.city,
    pickup.lat,
    pickup.lon,
    drop.address,
    drop.lat,
    drop.lon,
  ].join("|");
  useEffect(() => {
    setMeasured(null);
    setManualKm("");
    setMapsFailed(null);
    setQuote(null);
  }, [addressKey]);

  const distanceKm = measured ? measured.km : Number(manualKm) || 0;
  const fromMaps = measured != null;

  const measure = async () => {
    setError(null);
    setMapsFailed(null);
    setMeasuring(true);
    try {
      // Pins first. Coordinates are unambiguous; a typed address is whatever
      // Google decides it meant, which is how a 4 km run gets measured as 34.
      const origin =
        pickup.lat != null && pickup.lon != null
          ? `${pickup.lat},${pickup.lon}`
          : [pickup.address, pickup.city].filter(Boolean).join(", ");
      const destination =
        drop.lat != null && drop.lon != null
          ? `${drop.lat},${drop.lon}`
          : [drop.address, drop.city || pickup.city].filter(Boolean).join(", ");
      const res = await apiRequest<DistanceResult>("/partner/distance", {
        method: "POST",
        body: JSON.stringify({ origin, destination }),
      });
      if (res.ok) {
        setMeasured({ km: res.distanceKm, durationMin: res.durationMin });
      } else {
        setMeasured(null);
        setMapsFailed(res.reason);
      }
    } catch (e) {
      setMeasured(null);
      setMapsFailed(e instanceof Error ? e.message : "Could not measure the route");
    } finally {
      setMeasuring(false);
    }
  };

  // ── price ─────────────────────────────────────────────────────────────────

  const getQuote = useCallback(async () => {
    if (!(distanceKm > 0)) return;
    setQuoting(true);
    setError(null);
    try {
      setQuote(
        await apiRequest<Quote>("/partner/orders/quote", {
          method: "POST",
          body: JSON.stringify({ distanceKm, orderType, city: pickup.city }),
        })
      );
    } catch (e) {
      setQuote(null);
      setError(e instanceof Error ? e.message : "Could not price this order");
    } finally {
      setQuoting(false);
    }
  }, [distanceKm, orderType, pickup.city]);

  // Repriced whenever the distance or the type changes, so the figure on screen
  // is never for a different order than the one in the form.
  useEffect(() => {
    if (distanceKm > 0) getQuote();
    else setQuote(null);
  }, [distanceKm, orderType, getQuote]);

  // ── submit ────────────────────────────────────────────────────────────────

  const phoneDigits = dropPhone.replace(/\D/g, "");
  const ready =
    pickup.address.trim().length > 3 &&
    pickup.city.trim().length > 1 &&
    drop.address.trim().length > 3 &&
    dropName.trim().length > 1 &&
    phoneDigits.length === 10 &&
    distanceKm > 0 &&
    quote?.ok === true &&
    quote.sufficient;

  const place = async () => {
    if (!ready || placing) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await apiRequest<{ id: string; trackingNumber: string }>(
        "/partner/orders",
        {
          method: "POST",
          body: JSON.stringify({
            pickup: {
              address: pickup.address.trim(),
              city: pickup.city.trim(),
              lat: pickup.lat,
              lon: pickup.lon,
            },
            drop: {
              address: drop.address.trim(),
              city: (drop.city || pickup.city).trim(),
              name: dropName.trim(),
              phone: phoneDigits,
              lat: drop.lat,
              lon: drop.lon,
            },
            distanceKm,
            distanceFromMaps: fromMaps,
            orderType,
            codAmount: Number(codAmount) || 0,
            note: note.trim(),
          }),
        }
      );
      router.replace(`/portal/orders/${res.id}?placed=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place this order");
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="text-lg font-bold text-ink">Place a delivery order</h1>
        <p className="text-sm text-muted">
          A captain is offered the job the moment you confirm.
        </p>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {/* ── pickup ─────────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle
          action={
            <Link href="/portal/locations" className="text-xs font-semibold text-brand">
              Manage
            </Link>
          }
        >
          Pick up from
        </SectionTitle>

        <div className="space-y-3">
          {saved.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {saved.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => choosePickup(a.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                    pickupId === a.id
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-white text-muted hover:bg-surface"
                  }`}
                >
                  <span className="block font-bold">{a.label}</span>
                  <span className="block max-w-[14rem] truncate">{a.city}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => choosePickup(NEW_PICKUP)}
                className={`rounded-xl border border-dashed px-3 py-2 text-xs font-semibold transition ${
                  pickupId === NEW_PICKUP
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line text-muted hover:bg-surface"
                }`}
              >
                + One-off address
              </button>
            </div>
          ) : null}

          <LocationPicker
            label="Pickup"
            hint="Pick the shop from the map so the pin is right."
            value={pickup}
            fallbackCity={partner?.city}
            onChange={(v) => {
              setPickup(v);
              // Edited by hand, so it is no longer the saved location it came
              // from — the chip must not stay lit on something that changed.
              setPickupId(NEW_PICKUP);
            }}
          />

          <Field label="City" hint="The rate card for this city sets the price.">
            <input
              value={pickup.city}
              onChange={(e) => setPickup({ ...pickup, city: e.target.value })}
              placeholder="Ratlam"
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      {/* ── drop ───────────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Deliver to</SectionTitle>
        <div className="space-y-3">
          <LocationPicker
            label="Drop"
            hint="Search for your customer's address to pin it."
            value={drop}
            fallbackCity={pickup.city || partner?.city}
            onChange={setDrop}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Receiver's name">
              <input
                value={dropName}
                onChange={(e) => setDropName(e.target.value)}
                placeholder="Customer name"
                className={inputCls}
              />
            </Field>
            <Field
              label="Receiver's phone"
              error={
                dropPhone.length > 0 && phoneDigits.length !== 10
                  ? "A 10-digit number is needed"
                  : null
              }
              hint="The captain calls this number on arrival."
            >
              <input
                value={dropPhone}
                onChange={(e) => setDropPhone(e.target.value)}
                inputMode="numeric"
                maxLength={14}
                placeholder="98765 43210"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* ── distance ───────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Distance</SectionTitle>

        <Button
          variant="ghost"
          onClick={measure}
          disabled={
            measuring || pickup.address.trim().length < 4 || drop.address.trim().length < 4
          }
          className="w-full"
        >
          {measuring
            ? "Measuring the route…"
            : measured
              ? "Measure again"
              : "Measure with Google Maps"}
        </Button>

        {measured ? (
          <div className="mt-3 rounded-xl border border-ok/25 bg-ok-soft px-3 py-2.5">
            <p className="tnum text-sm font-bold text-ok">
              {measured.km.toFixed(1)} km
              {measured.durationMin ? ` · about ${measured.durationMin} min` : ""}
            </p>
            <p className="text-xs text-ok/80">Driving distance from Google Maps.</p>
          </div>
        ) : null}

        {mapsFailed ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2.5 text-xs text-warn">
              Maps could not measure this route — {mapsFailed}
            </div>
            <Field
              label="Distance in km (entered by hand)"
              hint="This is your figure, not a Maps measurement. The order is priced and billed on it."
            >
              <input
                value={manualKm}
                onChange={(e) => setManualKm(e.target.value)}
                inputMode="decimal"
                placeholder="4.5"
                className={inputCls}
              />
            </Field>
          </div>
        ) : null}

        {!measured && !mapsFailed ? (
          <p className="mt-2 text-xs text-faint">
            Fill in both addresses, then measure. The price comes from the measured
            distance.
          </p>
        ) : null}
      </Card>

      {/* ── type and cash ──────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Order details</SectionTitle>
        <div className="space-y-3">
          <Field label="What is being delivered">
            <div className="flex gap-2">
              {(["standard", "food"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    orderType === t
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-white text-muted hover:bg-surface"
                  }`}
                >
                  {t === "standard" ? "Package" : "Food"}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Cash to collect (COD)"
            hint="Leave blank if the customer has already paid you."
          >
            <input
              value={codAmount}
              onChange={(e) => setCodAmount(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              className={inputCls}
            />
          </Field>

          <Field label="Note for the captain (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ring the bell twice, 2nd floor"
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      {/* ── price and confirm ──────────────────────────────────────────────── */}
      <Card className="border-ink/10">
        <SectionTitle>Your price</SectionTitle>

        {distanceKm <= 0 ? (
          <p className="text-sm text-muted">
            The price appears once the distance is known.
          </p>
        ) : quoting && !quote ? (
          <p className="text-sm text-muted">Checking the rate card…</p>
        ) : quote && quote.ok ? (
          <div className="space-y-2">
            <Row label={`Delivery fee · ${quote.slabLabel ?? ""}`} value={inr(quote.fee)} strong />
            <Row
              label="Distance"
              value={`${distanceKm.toFixed(1)} km`}
              note={fromMaps ? "from Google Maps" : "entered by hand"}
            />
            {Number(codAmount) > 0 ? (
              <Row
                label="Cash the captain collects"
                value={inr(Number(codAmount))}
                note="settled to you separately"
              />
            ) : null}
            <div className="!mt-3 border-t border-line pt-3">
              <Row label="Wallet balance now" value={inr(quote.walletBalance)} />
              <Row
                label="After this order"
                value={inr(quote.balanceAfter)}
                strong
                tone={quote.sufficient ? undefined : "bad"}
              />
            </div>

            {!quote.sufficient ? (
              <div className="rounded-xl border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-bad">
                Your wallet is short of this fee.{" "}
                <Link href="/portal/wallet" className="font-bold underline">
                  Top up
                </Link>{" "}
                to place the order.
              </div>
            ) : null}
          </div>
        ) : quote ? (
          <div className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2.5 text-sm text-warn">
            {quote.reason ?? "This order cannot be priced."}
            {!quote.hasRateCard ? (
              <span className="mt-1 block text-xs">
                Ask your account manager to set up a rate card for {quote.city || "this city"}.
              </span>
            ) : null}
          </div>
        ) : null}

        <Button onClick={place} disabled={!ready || placing} className="mt-4 w-full">
          {placing
            ? "Placing the order…"
            : quote?.ok
              ? `Confirm and pay ${inr(quote.fee)}`
              : "Confirm order"}
        </Button>
        <p className="mt-2 text-center text-xs text-faint">
          The fee is taken from your wallet when you confirm, and returned in full
          if you cancel before pickup.
        </p>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  note,
  strong,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  tone?: "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">
        {label}
        {note ? <span className="ml-1 text-xs text-faint">({note})</span> : null}
      </span>
      <span
        className={`tnum shrink-0 ${
          strong ? "text-base font-bold" : "text-sm font-medium"
        } ${tone === "bad" ? "text-bad" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}
