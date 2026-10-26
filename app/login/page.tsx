"use client";

/**
 * Partner sign-in.
 *
 * Accounts are created by Parcelwalah — there is no sign-up link, because
 * offering one would invite businesses to register and then wait for an
 * approval that this portal does not grant.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiRequest, storeSession, type Partner } from "@/lib/api";
import { Button, ErrorNote, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // a double tap must not send two sign-in attempts
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{
        partner: Partner;
        accessToken: string;
      }>("/partner/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      storeSession(res.accessToken, res.partner);
      router.replace("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <Image
            src="/logo-parcelwalah.png"
            alt="Parcelwalah"
            width={56}
            height={56}
            className="mx-auto mb-3 rounded-2xl"
          />
          <h1 className="text-xl font-bold text-ink">Parcelwalah Partners</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to place and track your deliveries.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-line bg-white p-5"
        >
          {error ? <ErrorNote>{error}</ErrorNote> : null}

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.in"
              className={inputCls}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-faint">
            Accounts are created by Parcelwalah. Contact your account manager to
            get access.
          </p>
        </form>
      </div>
    </main>
  );
}
