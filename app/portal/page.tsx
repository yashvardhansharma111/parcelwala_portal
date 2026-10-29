"use client";

/**
 * Dashboard — what is happening right now, and whether anything needs doing.
 *
 * Ordered by urgency rather than by how interesting the number is: a wallet
 * that cannot cover the next order stops the business, so it leads.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, inr, istDate } from "@/lib/api";
import { Card, Empty, ErrorNote, SectionTitle, Spinner, StatusBadge } from "@/components/ui";

type OrderRow = {
  id: string;
  trackingNumber: string;
  status: string;
  assignmentStatus?: string;
  drop?: { address?: string };
  fee: number;
  codAmount: number;
  source: string;
  createdAt: string | null;
};

type Dashboard = {
  walletBalance: number;
  /** Cheapest fee in this partner's rate card — null if no card is set. */
  cheapestFee: number | null;
  placedToday: number;
  deliveredToday: number;
  activeNow: number;
  pendingCod: number;
  recent: OrderRow[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<Dashboard>("/partner/dashboard"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your dashboard");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner />;

  // Below the cheapest fee in this partner's own card, no order of any length
  // can be placed. That is the moment worth warning about, and it comes from
  // the card rather than a number written into this screen.
  const low = data.cheapestFee != null && data.walletBalance < data.cheapestFee;

  return (
    <div className="space-y-5">
      <Card className={low ? "border-warn/40 bg-warn-soft/40" : ""}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Wallet balance
            </p>
            <p className="tnum mt-1 text-3xl font-black text-ink">
              {inr(data.walletBalance)}
            </p>
            {low ? (
              <p className="mt-1 text-sm font-medium text-warn">
                Below {inr(data.cheapestFee)}, the cheapest delivery in your
                city — top up to keep placing orders.
              </p>
            ) : null}
          </div>
          <Link
            href="/portal/wallet"
            className="rounded-full bg-gradient-to-br from-brand to-brand-2 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Top up
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Placed today" value={String(data.placedToday)} />
        <Stat label="Delivered today" value={String(data.deliveredToday)} />
        <Stat label="Active now" value={String(data.activeNow)} />
        <Link href="/portal/settlements" className="block">
          <Stat
            label="Cash owed to you"
            value={inr(data.pendingCod)}
            tone={data.pendingCod > 0 ? "warn" : undefined}
          />
        </Link>
      </div>

      <Link
        href="/portal/place-order"
        className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white transition hover:bg-ink/90"
      >
        <span>
          <span className="block text-sm font-bold">Place a delivery order</span>
          <span className="block text-xs text-white/70">
            Pickup, drop, and a price before you confirm
          </span>
        </span>
        <span className="text-xl">→</span>
      </Link>

      <section>
        <SectionTitle
          action={
            <Link href="/portal/orders" className="text-xs font-semibold text-brand">
              View all
            </Link>
          }
        >
          Recent orders
        </SectionTitle>

        {data.recent.length === 0 ? (
          <Empty
            title="No orders yet"
            hint="Your deliveries will appear here once you place your first order."
            action={{ label: "Place an order", href: "/portal/place-order" }}
          />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {data.recent.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/portal/orders/${o.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {o.trackingNumber}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {o.drop?.address || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">{istDate(o.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={o.status} assigned={o.assignmentStatus} />
                      <p className="tnum mt-1 text-sm font-bold text-ink">{inr(o.fee)}</p>
                      {o.codAmount > 0 ? (
                        <p className="tnum text-xs text-warn">COD {inr(o.codAmount)}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={`tnum mt-1 text-xl font-bold ${tone === "warn" ? "text-warn" : "text-ink"}`}
      >
        {value}
      </p>
    </Card>
  );
}
