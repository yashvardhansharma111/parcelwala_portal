/**
 * The portal's small set of building blocks, styled to the Parcelwalah public
 * website system (web.parcelwalah.in): orange gradient pill buttons, 22px
 * cards, 12px inputs, Plus Jakarta Sans / Space Grotesk.
 *
 * Hand-written rather than pulled from a component library: the portal needs a
 * card, a button, a badge and an empty state, and a kit would add a dependency
 * to maintain and a second design language to reconcile with the website.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-white shadow-md ${padded ? "p-4 sm:p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  size?: "md" | "sm";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2.5 text-sm";
  const variants = {
    primary:
      "bg-gradient-to-br from-brand to-brand-2 text-white shadow-glow hover:-translate-y-0.5 hover:shadow-lg",
    ghost:
      "border border-line bg-white text-dark hover:-translate-y-0.5 hover:shadow-md",
    danger: "border border-bad/30 bg-bad-soft text-bad hover:bg-bad/15",
  }[variant];

  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * Order status, in the partner's words.
 *
 * The backend calls them Created / Picked / Shipped, which describe what the
 * system is doing. A partner is asking where their parcel is.
 */
const STATUS: Record<string, { label: string; cls: string }> = {
  Created: { label: "Placed", cls: "bg-info-soft text-info" },
  Picked: { label: "Picked up", cls: "bg-warn-soft text-warn" },
  Shipped: { label: "On the way", cls: "bg-warn-soft text-warn" },
  Delivered: { label: "Delivered", cls: "bg-ok-soft text-ok" },
  Cancelled: { label: "Cancelled", cls: "bg-bad-soft text-bad" },
  Returned: { label: "Returned", cls: "bg-bad-soft text-bad" },
  PendingPayment: { label: "Awaiting payment", cls: "bg-surface text-muted" },
};

export function StatusBadge({ status, assigned }: { status: string; assigned?: string }) {
  const meta = STATUS[status] ?? { label: status, cls: "bg-surface text-muted" };
  // "Placed" and "Accepted" are the same row to the system but a very different
  // answer to "has anyone picked this up yet".
  const label =
    status === "Created" && assigned === "assigned" ? "Accepted" : meta.label;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
      {label}
    </span>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-white px-6 py-12 text-center shadow-md">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-4 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-dark">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-input border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-input border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-bad">
      {children}
    </div>
  );
}
