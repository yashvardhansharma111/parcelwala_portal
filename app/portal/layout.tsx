"use client";

/**
 * The signed-in shell: guard, navigation, and the wallet balance in the header.
 *
 * The balance sits in the chrome on every screen on purpose. The wallet is
 * prepaid, so running out does not degrade the service — it stops it — and a
 * partner should never discover that on the confirm step of an order.
 */

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, clearSession, getStoredPartner, getToken, inr, type Partner } from "@/lib/api";
import { Spinner } from "@/components/ui";

const NAV = [
  { href: "/portal", label: "Home", exact: true },
  { href: "/portal/place-order", label: "Place order" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/wallet", label: "Wallet" },
  // Locations and the rate card live under Account rather than in the bar: they
  // are set up once, and a five-item bottom bar on a phone is five small taps.
  { href: "/portal/account", label: "Account" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setPartner(getStoredPartner());
    setReady(true);
  }, [router]);

  const loadBalance = useCallback(async () => {
    try {
      const d = await apiRequest<{ walletBalance: number }>("/partner/dashboard");
      setBalance(d.walletBalance);
    } catch {
      // The header is not worth an error state; the screen below will say so.
    }
  }, []);

  // Re-read on navigation: placing an order changes the balance, and a stale
  // figure in the header is worse than none.
  useEffect(() => {
    if (ready) loadBalance();
  }, [ready, pathname, loadBalance]);

  const signOut = () => {
    clearSession();
    router.replace("/login");
  };

  if (!ready) return <Spinner label="Opening your portal…" />;

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-2">
            <Image
              src="/logo-parcelwalah.png"
              alt="Parcelwalah"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="hidden text-sm font-bold text-ink sm:block">
              {partner?.name ?? "Partner"}
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive(item)
                    ? "bg-brand-soft text-brand"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/portal/wallet"
            className="ml-auto rounded-xl border border-line px-3 py-1.5 text-right md:ml-0"
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-faint">
              Wallet
            </span>
            <span className="tnum block text-sm font-bold text-ink">
              {balance == null ? "—" : inr(balance)}
            </span>
          </Link>

          {/* Desktop only. On a phone the Account tab carries sign-out, and the
              header has no room to spare next to the balance. */}
          <button
            onClick={signOut}
            className="hidden rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:text-bad md:block"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:pb-10">{children}</main>

      {/* Phone navigation. Partners place orders standing at a counter, so the
          actions sit under the thumb rather than behind a menu. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white md:hidden">
        <div className="mx-auto flex max-w-5xl">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 py-2.5 text-center text-xs font-semibold transition ${
                isActive(item) ? "text-brand" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
