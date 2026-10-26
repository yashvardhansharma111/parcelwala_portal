# Parcelwalah Partner Portal

The B2B portal. A business (first one: Zipeey, a grocery app) signs in, places
delivery orders against a prepaid wallet, and tracks them; Parcelwalah supplies
the captains.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

It needs a backend. Point it at one with `NEXT_PUBLIC_API_BASE_URL`
(see `.env.example`); `.env.local` is already set to a backend on this machine.

```bash
# in ../backend
npm run dev          # http://localhost:8080
```

Then create a partner to sign in as:

```bash
# in ../backend — seeds rate cards for Ratlam/Jaora/Ujjain and one test partner
npx tsx scripts/seed-partner-portal.ts
# -> test.partner@parcelwalah.in / partner1234
```

## How it fits the rest of the system

**The portal holds no credentials of its own.** No Firebase config, no Google
key, no database access. Every read and write goes through the same API the
customer and captain apps use. That is what keeps one partner's orders out of
another partner's browser, and it means pricing, the wallet transaction and
dispatch behave identically wherever an order came from.

**A portal order is an ordinary booking.** It lands in `bookings` with
`source: "Portal"` and a `merchantId`, and goes out through the same dispatch as
a customer order — so it inherits declined-offer handling, the 30-second offer
window, the 5-minute auto-cancel, radius and staleness rules, service areas, and
the transaction that stops two captains taking one job. The captain app needed no
change to see these orders.

**The wallet is prepaid, and the debit is in the same Firestore transaction as
the order.** A fee taken with no order and an order placed with no fee are both
money going missing, in opposite directions, so neither is allowed to exist
alone. Cancelling before pickup refunds in full; after pickup it cannot, because
the captain has already done the work.

**Distance comes from Google, or it is labelled as typed.** Every screen that
shows a distance says where it came from. See the note in
`backend/src/services/partnerService.ts` for what was tried and rejected here.

**Maps is split in two.** Address search and reverse geocoding go through the
backend (`/map/autocomplete`, `/map/place-details`, `/map/details`), which
already holds the Places key — so the portal gets autocomplete without shipping
a credential to every shop counter. Only the visible map and its draggable pin
use `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, which does reach the browser and
**must be restricted** in Google Cloud to the portal's domains and to the Maps
JavaScript API. Without that key the pickers still work from search alone; you
just lose the pin, and losing the pin has a cost (below).

**The pin decides whether a captain is asked for a pickup code.** A captain
whose GPS puts them within 100 m of the pickup pin is not asked for one — being
there is the proof. Further away, they are asked exactly once. If the location
has no pin at all, the code is always required, because nothing can be checked.
That is why saved locations warn when they have no pin, and why the picker says
so too.

## Screens

| Route | What it is for |
| --- | --- |
| `/login` | Sign in. No sign-up: accounts are created by Parcelwalah. |
| `/portal` | Balance, today's activity, COD outstanding, recent orders. |
| `/portal/place-order` | Pickup, drop, distance, price, confirm. |
| `/portal/orders` | Every order, with filters; refreshes itself while live. |
| `/portal/orders/[id]` | One order: route, captain, pickup code, charges, history, cancel. |
| `/portal/wallet` | Balance, passbook, and a top-up request with a UTR. |
| `/portal/locations` | Saved pickup locations. |
| `/portal/rate-card` | The agreed prices for the partner's city. |
| `/portal/settlements` | COD owed to the partner, and what we have paid back. |
| `/portal/account` | Business details, settings, support, sign out. |

## Tests

The API the portal depends on is covered end to end, over HTTP, including
cross-partner access attempts:

```bash
# in ../backend, with a backend running on :8099
npx tsx scripts/test-partner-portal-api.ts --base http://localhost:8099   # 96 checks
npx tsx scripts/test-partner-admin-api.ts  --base http://localhost:8099   # 65 checks
npx tsx scripts/test-pickup-otp-rule.ts                                   # 33 checks
```

The first two leave rows in Firestore; `scripts/clean-test-portal-data.ts
--apply` removes them and resets the test wallets. The OTP suite cleans up after
itself.

The operator side of this portal lives in the admin console:
`/partners`, `/partner-topups` and `/rate-cards`.
