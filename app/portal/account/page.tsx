"use client";

/**
 * Account — the business on file, and everything that isn't a daily action.
 *
 * Business details are shown, not edited. The name, city and GST on an invoice
 * have to match what Parcelwalah has agreed and billed against, so changing
 * them goes through the account manager rather than a text box here.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest, clearSession, getStoredPartner, inr } from "@/lib/api";
import { Button, Card, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { SUPPORT } from "@/lib/support";

type Profile = {
  id: string;
  name: string;
  ownerName?: string;
  phone?: string;
  email: string;
  city: string;
  businessType?: string;
  status: "active" | "blocked";
  walletBalance: number;
  createdAt?: string | null;
};

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cached = getStoredPartner();

  useEffect(() => {
    apiRequest<{ partner: Profile }>("/partner/me")
      .then((d) => setProfile(d.partner))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load your account")
      );
  }, []);

  const signOut = () => {
    clearSession();
    router.replace("/login");
  };

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!profile) return <Spinner label="Loading your account…" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-ink">Account</h1>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-card bg-gradient-to-br from-brand to-brand-2 text-lg font-black text-white">
            {(profile.name || cached?.name || "P").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">{profile.name}</p>
            <p className="truncate text-sm text-muted">{profile.email}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2.5 border-t border-line pt-4">
          <Detail label="City" value={profile.city} />
          {profile.ownerName ? <Detail label="Contact person" value={profile.ownerName} /> : null}
          {profile.phone ? <Detail label="Phone" value={profile.phone} /> : null}
          {profile.businessType ? (
            <Detail label="Business" value={profile.businessType} />
          ) : null}
          <Detail label="Wallet balance" value={inr(profile.walletBalance)} />
          <Detail
            label="Status"
            value={profile.status === "active" ? "Active" : "Blocked"}
            tone={profile.status === "active" ? "ok" : "bad"}
          />
        </dl>

        <p className="mt-3 text-xs text-faint">
          To change your business details, contact your account manager — these are
          the details your invoices are raised against.
        </p>
      </Card>

      <section>
        <SectionTitle>Settings</SectionTitle>
        <Card padded={false}>
          <ul className="divide-y divide-line">
            <NavRow
              href="/portal/locations"
              title="Pickup locations"
              sub="Your shops and warehouses"
            />
            <NavRow
              href="/portal/settlements"
              title="Cash collected for you"
              sub="COD owed, and what we have paid back"
            />
            <NavRow
              href="/portal/rate-card"
              title="Rate card"
              sub={`Your delivery prices in ${profile.city}`}
            />
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Help</SectionTitle>
        <Card padded={false}>
          <ul className="divide-y divide-line">
            <li>
              <a
                href={`https://wa.me/${SUPPORT.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    WhatsApp support
                  </span>
                  <span className="block text-xs text-muted">
                    {SUPPORT.whatsappDisplay}
                  </span>
                </span>
                <span className="text-muted">→</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SUPPORT.email}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">Email us</span>
                  <span className="block text-xs text-muted">{SUPPORT.email}</span>
                </span>
                <span className="text-muted">→</span>
              </a>
            </li>
          </ul>
        </Card>
      </section>

      <Button variant="ghost" onClick={signOut} className="w-full">
        Sign out
      </Button>
    </div>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`tnum shrink-0 text-sm font-semibold ${
          tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function NavRow({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface"
      >
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-xs text-muted">{sub}</span>
        </span>
        <span className="text-muted">→</span>
      </Link>
    </li>
  );
}
