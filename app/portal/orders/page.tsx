"use client";

/**
 * Orders — every delivery this partner has placed.
 *
 * Filtering is server-side so the list stays correct as it grows past whatever
 * the browser happens to be holding. The totals under the filter bar describe
 * what is on screen, not the account as a whole, so they answer the question
 * the filter was asked.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, inr, istDate } from "@/lib/api";
import {
  Card,
  Empty,
  ErrorNote,
  StatusBadge,
  inputCls,
} from "@/components/ui";

type Order = {
  id: string;
  trackingNumber: string;
  status: string;
  assignmentStatus?: string;
  drop?: { address?: string; name?: string; phone?: string };
  city?: string;
  distanceKm?: number | null;
  fee: number;
  codAmount: number;
  codStage?: string | null;
  riderName?: string | null;
  createdAt: string | null;
};

const STATUSES = [
  { value: "", label: "All" },
  { value: "Created", label: "Placed" },
  { value: "Picked", label: "Picked up" },
  { value: "Shipped", label: "On the way" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [codOnly, setCodOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search.trim()) q.set("search", search.trim());
    if (codOnly) q.set("codOnly", "true");
    // Both ends go as bare dates. The backend resolves them against IST, which
    // is the calendar the partner picked them from — appending a time here would
    // send the server's idea of the end of the day instead.
    if (from) q.set("from", from);
    if (to) q.set("to", to);

    try {
      const data = await apiRequest<{ orders: Order[] }>(
        `/partner/orders?${q.toString()}`
      );
      setOrders(data.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your orders");
    }
  }, [status, search, codOnly, from, to]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = useMemo(() => {
    const list = orders ?? [];
    return {
      count: list.length,
      fees: list.reduce((s, o) => s + (o.fee || 0), 0),
      cod: list
        .filter((o) => o.codAmount > 0 && o.codStage !== "settled")
        .reduce((s, o) => s + o.codAmount, 0),
    };
  }, [orders]);

  const clearFilters = () => {
    setStatus("");
    setSearch("");
    setCodOnly(false);
    setFrom("");
    setTo("");
  };
  const filtered = Boolean(status || search || codOnly || from || to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">Orders</h1>
        <Link
          href="/portal/place-order"
          className="rounded-full bg-gradient-to-br from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          Place order
        </Link>
      </div>

      <Card className="space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tracking number, receiver name or phone"
          className={inputCls}
        />

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                status === s.value
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-muted hover:bg-surface"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCodOnly((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              codOnly
                ? "border-warn bg-warn text-white"
                : "border-line bg-white text-muted hover:bg-surface"
            }`}
          >
            COD only
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        {filtered ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-brand"
          >
            Clear filters
          </button>
        ) : null}
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {orders ? (
        <div className="grid grid-cols-3 gap-3">
          <Tally label={filtered ? "Matching" : "Total orders"} value={String(totals.count)} />
          <Tally label="Fees" value={inr(totals.fees)} />
          <Tally label="COD to settle" value={inr(totals.cod)} />
        </div>
      ) : null}

      {orders == null ? (
        <Card>
          <p className="text-sm text-muted">Loading your orders…</p>
        </Card>
      ) : orders.length === 0 ? (
        <Empty
          title={filtered ? "Nothing matches these filters" : "No orders yet"}
          hint={
            filtered
              ? "Try a wider date range, or clear the filters."
              : "Your deliveries will appear here once you place your first order."
          }
          action={filtered ? undefined : { label: "Place an order", href: "/portal/place-order" }}
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/portal/orders/${o.id}`}
                  className="block px-4 py-3 transition hover:bg-surface"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">
                          {o.trackingNumber}
                        </p>
                        <StatusBadge status={o.status} assigned={o.assignmentStatus} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {o.drop?.name ? `${o.drop.name} · ` : ""}
                        {o.drop?.address || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {istDate(o.createdAt)}
                        {o.distanceKm ? ` · ${Number(o.distanceKm).toFixed(1)} km` : ""}
                        {o.riderName ? ` · ${o.riderName}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm font-bold text-ink">{inr(o.fee)}</p>
                      {o.codAmount > 0 ? (
                        <p className="tnum text-xs font-semibold text-warn">
                          COD {inr(o.codAmount)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Tally({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="tnum mt-0.5 text-base font-bold text-ink">{value}</p>
    </Card>
  );
}
