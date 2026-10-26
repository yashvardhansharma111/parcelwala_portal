"use client";

/**
 * One order, in detail.
 *
 * Refreshes itself while the delivery is live — a partner leaves this open on a
 * counter to see whether anyone has accepted yet, and a screen that needs a
 * manual reload to answer that is no better than a list.
 *
 * The captain's phone number appears while the delivery is running and is
 * dropped once it is complete; the backend stops sending it, and this screen
 * only ever shows what it is given.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, inr, istDate } from "@/lib/api";
import { Button, Card, ErrorNote, SectionTitle, Spinner, StatusBadge } from "@/components/ui";

type TimelineEntry = { status: string; note?: string; timestamp: string };

type Order = {
  id: string;
  trackingNumber: string;
  status: string;
  assignmentStatus?: string;
  pickup?: { address?: string; city?: string; name?: string; phone?: string };
  drop?: { address?: string; city?: string; name?: string; phone?: string };
  parcelDetails?: { type?: string; description?: string };
  distanceKm?: number | null;
  distanceFromMaps?: boolean;
  fee: number;
  partnerSlab?: string | null;
  codAmount?: number;
  codStage?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  riderPhase?: string | null;
  pickupOtp?: string | null;
  pickupOtpRequired?: boolean | null;
  pickupOtpVerified?: boolean;
  arrivedDistanceM?: number | null;
  dropOtp?: string | null;
  cancellationReason?: string | null;
  timeline?: TimelineEntry[];
  createdAt: string | null;
};

const LIVE = ["Created", "Picked", "Shipped"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [justPlaced, setJustPlaced] = useState(false);
  const firstLoad = useRef(true);

  // Read from the URL rather than useSearchParams so this page does not have to
  // bail out of prerendering for a one-off success banner.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setJustPlaced(new URLSearchParams(window.location.search).get("placed") === "1");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ order: Order }>(`/partner/orders/${id}`);
      setOrder(data.order);
      setError(null);
    } catch (e) {
      // A failed refresh must not wipe an order that is already on screen.
      if (firstLoad.current) {
        setError(e instanceof Error ? e.message : "Could not load this order");
      }
    } finally {
      firstLoad.current = false;
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Polled only while something can still change, so a finished order stops
  // costing requests the moment it is finished.
  useEffect(() => {
    if (!order || !LIVE.includes(order.status)) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [order, load]);

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      const res = await apiRequest<{ refunded: number }>(
        `/partner/orders/${id}/cancel`,
        { method: "POST" }
      );
      setConfirmCancel(false);
      await load();
      router.refresh();
      if (res.refunded > 0) {
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel this order");
    } finally {
      setCancelling(false);
    }
  };

  if (error && !order) return <ErrorNote>{error}</ErrorNote>;
  if (!order) return <Spinner label="Opening the order…" />;

  const live = LIVE.includes(order.status);
  const canCancel = order.status === "Created";
  const accepted = order.assignmentStatus === "assigned";

  return (
    <div className="space-y-4">
      <Link href="/portal/orders" className="text-sm font-medium text-muted hover:text-ink">
        ← All orders
      </Link>

      {justPlaced ? (
        <div className="rounded-xl border border-ok/25 bg-ok-soft px-3 py-2.5 text-sm font-medium text-ok">
          Order placed. Captains nearby are being offered the job now.
        </div>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-ink">{order.trackingNumber}</h1>
            <p className="text-xs text-muted">Placed {istDate(order.createdAt)}</p>
          </div>
          <div className="text-right">
            <StatusBadge status={order.status} assigned={order.assignmentStatus} />
            <p className="tnum mt-1 text-lg font-bold text-ink">{inr(order.fee)}</p>
          </div>
        </div>

        {order.status === "Created" && !accepted ? (
          <p className="mt-3 rounded-xl bg-info-soft px-3 py-2 text-xs font-medium text-info">
            Looking for a captain. This usually takes a minute or two.
          </p>
        ) : null}
        {order.status === "Cancelled" ? (
          <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-xs font-medium text-bad">
            {order.cancellationReason || "This order was cancelled."}
          </p>
        ) : null}
      </Card>

      <PickupOtp order={order} />

      {order.dropOtp ? (
        <Card className="border-info/30 bg-info-soft/40">
          <SectionTitle>Delivery code</SectionTitle>
          <p className="text-sm text-ink">
            The captain is at the drop. Your customer was sent this code by SMS —
            if they did not get it, you can read it to them.
          </p>
          <p className="tnum mt-2 text-3xl font-black tracking-[0.3em] text-info">
            {order.dropOtp}
          </p>
        </Card>
      ) : null}

      {order.riderName ? (
        <Card>
          <SectionTitle>Captain</SectionTitle>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">{order.riderName}</p>
              <p className="text-xs text-muted">
                {order.riderPhone ?? "Contact details close once the order is delivered."}
              </p>
            </div>
            {order.riderPhone ? (
              <a
                href={`tel:${order.riderPhone}`}
                className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-surface"
              >
                Call
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Route</SectionTitle>
        <Leg
          tone="pickup"
          title="Pick up"
          address={order.pickup?.address}
          sub={[order.pickup?.name, order.pickup?.city].filter(Boolean).join(" · ")}
        />
        <div className="my-1 ml-[7px] h-5 border-l-2 border-dotted border-line" />
        <Leg
          tone="drop"
          title="Deliver"
          address={order.drop?.address}
          sub={[order.drop?.name, order.drop?.phone].filter(Boolean).join(" · ")}
        />
      </Card>

      <Card>
        <SectionTitle>Charges</SectionTitle>
        <div className="space-y-2">
          <Row
            label="Delivery fee"
            value={inr(order.fee)}
            note={order.partnerSlab ?? undefined}
            strong
          />
          <Row
            label="Distance"
            value={order.distanceKm ? `${Number(order.distanceKm).toFixed(1)} km` : "—"}
            note={
              order.distanceKm
                ? order.distanceFromMaps
                  ? "measured by Google Maps"
                  : "entered by hand"
                : undefined
            }
          />
          {order.codAmount && order.codAmount > 0 ? (
            <Row
              label="Cash collected from customer"
              value={inr(order.codAmount)}
              note={
                order.codStage === "settled"
                  ? "settled to you"
                  : "to be settled to you"
              }
            />
          ) : null}
          {order.parcelDetails?.type ? (
            <Row label="Contents" value={order.parcelDetails.type} />
          ) : null}
          {order.parcelDetails?.description ? (
            <Row label="Your note" value={order.parcelDetails.description} />
          ) : null}
        </div>
      </Card>

      {order.timeline && order.timeline.length > 0 ? (
        <Card>
          <SectionTitle>History</SectionTitle>
          <ul className="space-y-3">
            {[...order.timeline]
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
              .map((t, i) => (
                <li key={`${t.timestamp}-${i}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{t.status}</p>
                    {t.note ? <p className="text-xs text-muted">{t.note}</p> : null}
                    <p className="text-xs text-faint">{istDate(t.timestamp)}</p>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      {canCancel ? (
        <Card>
          {confirmCancel ? (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                Cancel this order? The {inr(order.fee)} fee goes straight back to
                your wallet.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={cancel} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Yes, cancel it"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                  Keep the order
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmCancel(true)} className="w-full">
              Cancel this order
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-faint">
            Cancelling is only possible before the captain picks the parcel up.
          </p>
        </Card>
      ) : null}

      {live ? (
        <p className="text-center text-xs text-faint">
          This page updates by itself every few seconds.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The pickup code, and whether it will be asked for.
 *
 * A captain standing at the shop does not need a code — the server can already
 * see they are there — so the card says so instead of making someone read out
 * four digits for nothing. It only becomes an instruction once the captain marks
 * Arrived from further away, and it disappears once the parcel is collected.
 */
function PickupOtp({ order }: { order: Order }) {
  if (!order.pickupOtp) return null;
  if (order.pickupOtpVerified) return null;
  if (!["Created"].includes(order.status)) return null;

  const required = order.pickupOtpRequired;
  const arrived = order.riderPhase === "arrived_pickup";

  // Waived: the captain marked Arrived from inside the pickup radius.
  if (required === false) {
    return (
      <Card className="border-ok/30 bg-ok-soft/40">
        <SectionTitle>Pickup code</SectionTitle>
        <p className="text-sm font-medium text-ok">
          Not needed — the captain is at your shop
          {order.arrivedDistanceM != null ? ` (${order.arrivedDistanceM} m away)` : ""}.
          Just hand over the parcel.
        </p>
      </Card>
    );
  }

  return (
    <Card className={required ? "border-brand/40 bg-brand-soft" : ""}>
      <SectionTitle>Pickup code</SectionTitle>
      <p className="tnum text-4xl font-black tracking-[0.3em] text-ink">
        {order.pickupOtp}
      </p>
      <p className="mt-2 text-sm text-muted">
        {required
          ? arrived
            ? "The captain marked Arrived from away from your shop, so they need this code to collect the parcel."
            : "The captain needs this code to collect the parcel."
          : "Give this to the captain only if they ask. They will not need it if they reach your shop — we check their location."}
      </p>
      <p className="mt-2 text-xs text-faint">
        Never share it before the captain is in front of you.
      </p>
    </Card>
  );
}

function Leg({
  tone,
  title,
  address,
  sub,
}: {
  tone: "pickup" | "drop";
  title: string;
  address?: string;
  sub?: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] ${
          tone === "pickup" ? "border-brand" : "border-ok"
        }`}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">{title}</p>
        <p className="text-sm font-medium text-ink">{address || "—"}</p>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="shrink-0 text-right">
        <span
          className={`tnum block text-ink ${strong ? "text-base font-bold" : "text-sm font-medium"}`}
        >
          {value}
        </span>
        {note ? <span className="block text-xs text-faint">{note}</span> : null}
      </span>
    </div>
  );
}
