"use client";

/**
 * Saved pickup locations.
 *
 * Most partners dispatch from one or two shops all day. Saving them turns the
 * pickup half of an order into one tap, which is the difference between this
 * portal being usable at a busy counter and not.
 */

import { useCallback, useEffect, useState } from "react";
import { apiRequest, getStoredPartner } from "@/lib/api";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  SectionTitle,
  Spinner,
  inputCls,
} from "@/components/ui";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";

type Address = {
  id: string;
  label: string;
  address: string;
  city: string;
  lat?: number | null;
  lon?: number | null;
  isDefault: boolean;
};

type Draft = {
  id?: string;
  label: string;
  isDefault: boolean;
  place: PickedLocation;
};

const blank = (city: string): Draft => ({
  label: "",
  isDefault: false,
  place: { address: "", lat: null, lon: null, city },
});

export default function LocationsPage() {
  const partner = getStoredPartner();
  const [list, setList] = useState<Address[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiRequest<{ addresses: Address[] }>("/partner/locations");
      setList(d.addresses);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your locations");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || saving) return;
    setFormError(null);
    setSaving(true);
    try {
      await apiRequest(
        draft.id ? `/partner/locations/${draft.id}` : "/partner/locations",
        {
          method: draft.id ? "PATCH" : "POST",
          body: JSON.stringify({
            id: draft.id,
            label: draft.label,
            isDefault: draft.isDefault,
            address: draft.place.address,
            city: draft.place.city,
            // The pin is the point of saving a location: it is what lets a
            // captain who reaches this shop skip the pickup code.
            lat: draft.place.lat,
            lon: draft.place.lon,
          }),
        }
      );
      setDraft(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this location");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await apiRequest(`/partner/locations/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove this location");
    } finally {
      setRemoving(null);
    }
  };

  if (error && !list) return <ErrorNote>{error}</ErrorNote>;
  if (!list) return <Spinner label="Loading your locations…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Pickup locations</h1>
          <p className="text-sm text-muted">Your shops and warehouses.</p>
        </div>
        {draft ? null : (
          <Button size="sm" onClick={() => setDraft(blank(partner?.city ?? ""))}>
            Add
          </Button>
        )}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {draft ? (
        <Card>
          <SectionTitle>{draft.id ? "Edit location" : "New location"}</SectionTitle>
          <form onSubmit={save} className="space-y-3">
            {formError ? <ErrorNote>{formError}</ErrorNote> : null}

            <Field label="Name" hint="What you call it — Main Shop, Warehouse 2.">
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Main Shop"
                className={inputCls}
                required
              />
            </Field>

            <LocationPicker
              label="Location"
              hint="Search for the shop, then drag the pin onto the door."
              value={draft.place}
              fallbackCity={partner?.city}
              onChange={(place) => setDraft({ ...draft, place })}
            />

            <Field label="City" hint="The rate card for this city prices the order.">
              <input
                value={draft.place.city}
                onChange={(e) =>
                  setDraft({ ...draft, place: { ...draft.place, city: e.target.value } })
                }
                placeholder="Ratlam"
                className={inputCls}
                required
              />
            </Field>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm text-ink">
                Use this as the default pickup location
              </span>
            </label>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save location"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {list.length === 0 && !draft ? (
        <Empty
          title="No saved locations"
          hint="Save the shop you dispatch from and it becomes one tap when you place an order."
        />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-ink">{a.label}</p>
                    {a.isDefault ? (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{a.address}</p>
                  <p className="text-xs text-faint">{a.city}</p>
                  {a.lat == null || a.lon == null ? (
                    <p className="mt-1 text-xs font-medium text-warn">
                      No map pin — captains will always be asked for a pickup
                      code here. Edit to add one.
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: a.id,
                        label: a.label,
                        isDefault: a.isDefault,
                        place: {
                          address: a.address,
                          lat: a.lat ?? null,
                          lon: a.lon ?? null,
                          city: a.city,
                        },
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => remove(a.id)}
                    disabled={removing === a.id}
                  >
                    {removing === a.id ? "…" : "Remove"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
