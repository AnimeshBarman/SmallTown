"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, Loader2, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeToAuth } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const PAGE_SIZE = 12;

type ListingType = "room" | "pg" | "flat";
type ListingStatus = "active" | "removed" | "all";
type Profile = { role: string };
type ModerationAction = {
  status: "active" | "removed";
  reason: string | null;
  admin_email: string | null;
  created_at: string;
};
type AdminListing = {
  id: string;
  title: string;
  area: string | null;
  address: string | null;
  city: string | null;
  description: string | null;
  type: ListingType;
  price: number;
  image_urls: string[];
  owner_id: string;
  owner_name: string | null;
  owner_email: string;
  contact_phone: string | null;
  status: string;
  view_count: number;
  created_at: string;
  moderation_reason: string | null;
  moderated_at: string | null;
};
type AdminListingPage = { items: AdminListing[]; total: number; limit: number; offset: number };
type ListingDeletionNotice = {
  id: string;
  property_id: string;
  property_title: string;
  city: string | null;
  owner_email: string;
  admin_email: string;
  reason: string;
  deleted_at: string;
  moderation_history: ModerationAction[];
};

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);
  const [city, setCity] = useState("all");
  const [type, setType] = useState<"all" | ListingType>("all");
  const [statusFilter, setStatusFilter] = useState<ListingStatus>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [removalId, setRemovalId] = useState<string | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [deletionId, setDeletionId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [showDeletionHistory, setShowDeletionHistory] = useState(false);
  const [historyListingId, setHistoryListingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const profileQuery = useQuery<Profile>({
    queryKey: ["profile"],
    enabled: signedIn,
    queryFn: async () => (await api.get<Profile>("/auth/me")).data,
  });
  const citiesQuery = useQuery<string[]>({
    queryKey: ["admin", "cities"],
    enabled: signedIn && profileQuery.data?.role === "admin",
    queryFn: async () => (await api.get<string[]>("/moderation/cities")).data,
    staleTime: 5 * 60 * 1000,
  });
  const listingsQuery = useQuery<AdminListingPage>({
    queryKey: ["admin", "properties", city, type, statusFilter, search, offset],
    enabled: signedIn && profileQuery.data?.role === "admin",
    queryFn: async () => (
      await api.get<AdminListingPage>("/moderation/properties", {
        params: {
          city: city === "all" ? undefined : city,
          type: type === "all" ? undefined : type,
          status: statusFilter,
          search: search || undefined,
          limit: PAGE_SIZE,
          offset,
        },
      })
    ).data,
    staleTime: 15 * 1000,
  });
  const historyQuery = useQuery<ModerationAction[]>({
    queryKey: ["admin", "property-history", historyListingId],
    enabled: Boolean(historyListingId) && signedIn && profileQuery.data?.role === "admin",
    queryFn: async () => (
      await api.get<ModerationAction[]>(`/moderation/properties/${historyListingId}/history`)
    ).data,
  });
  const deletionHistoryQuery = useQuery<ListingDeletionNotice[]>({
    queryKey: ["admin", "deletions"],
    enabled: showDeletionHistory && signedIn && profileQuery.data?.role === "admin",
    queryFn: async () => (await api.get<ListingDeletionNotice[]>("/moderation/deletions")).data,
  });

  const moderationMutation = useMutation({
    mutationFn: async (action: { id: string; status: "active" | "removed"; reason?: string }) =>
      api.patch(`/moderation/properties/${action.id}`, {
        status: action.status,
        reason: action.reason,
      }),
    onMutate: () => setSuccessMessage(""),
    onSuccess: async (_data, action) => {
      setRemovalId(null);
      setRemovalReason("");
      setOffset(0);
      setStatusFilter(action.status);
      setSuccessMessage(
        action.status === "removed"
          ? "Listing restricted and moved to Restricted listings."
          : "Listing restored and moved to Public listings.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "properties"] }),
        queryClient.invalidateQueries({ queryKey: ["properties"] }),
        queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] }),
      ]);
    },
  });
  const deletionMutation = useMutation({
    mutationFn: async (deletion: { id: string; reason: string }) =>
      api.delete<ListingDeletionNotice>(`/moderation/properties/${deletion.id}`, {
        data: { reason: deletion.reason },
      }),
    onMutate: () => setSuccessMessage(""),
    onSuccess: async () => {
      setDeletionId(null);
      setDeletionReason("");
      setDeletionConfirmation("");
      if (offset > 0 && listingsQuery.data?.items.length === 1) {
        setOffset((value) => Math.max(0, value - PAGE_SIZE));
      }
      setSuccessMessage("Listing permanently deleted. The owner can see the reason in their account.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "properties"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "deletions"] }),
        queryClient.invalidateQueries({ queryKey: ["properties"] }),
      ]);
    },
  });

  if (!signedIn) {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center dark:border-stone-700 dark:bg-stone-950">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-300">Sign in with an administrator account to open the admin panel.</p>
          <Link className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 font-semibold text-white" href="/login?next=%2Fadmin">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <div aria-label="Checking administrator access" className="mx-auto h-40 max-w-4xl animate-pulse rounded-3xl bg-stone-200 dark:bg-stone-800" />
      </main>
    );
  }

  if (profileQuery.isError) {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <p role="alert" className="mx-auto max-w-4xl rounded-2xl bg-red-50 p-5 text-red-800">
          Couldn&apos;t verify administrator access: {getErrorMessage(profileQuery.error)}
        </p>
      </main>
    );
  }

  if (profileQuery.data?.role !== "admin") {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center dark:border-stone-700 dark:bg-stone-950">
          <ShieldCheck className="mx-auto text-emerald-700 dark:text-emerald-300" size={30} />
          <h1 className="mt-4 text-2xl font-semibold">Administrator access only</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-300">This panel is only available to SmallTown administrators.</p>
          <Link href="/account" className="mt-5 inline-flex rounded-full border border-stone-300 px-5 py-2.5 font-semibold dark:border-stone-600">
            Back to account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-[#faf9f6] px-4 py-8 text-stone-900 dark:bg-stone-900 dark:text-stone-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/account" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <ArrowLeft size={16} /> Back to account
        </Link>
        <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={17} /> SmallTown administration
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Admin panel</h1>
            <p className="mt-2 text-stone-600 dark:text-stone-300">Review listings, respond to reports and keep the marketplace trustworthy.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/reports"
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              View listing reports
            </Link>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full"
              aria-expanded={showDeletionHistory}
              onClick={() => setShowDeletionHistory((open) => !open)}
            >
              {showDeletionHistory ? "Hide deletion history" : "Deletion history"}
            </Button>
          </div>
        </header>

        <Card className="mt-7 rounded-3xl border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-950 sm:p-5">
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setOffset(0);
              setSearch(searchDraft.trim());
            }}
          >
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                maxLength={100}
                placeholder="Search title, area, owner"
                aria-label="Search listings"
                className="h-10 pl-9"
              />
            </div>
            <select
              aria-label="Filter by city"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setOffset(0);
              }}
              className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              <option value="all">All cities</option>
              {(citiesQuery.data ?? []).map((availableCity) => (
                <option key={availableCity} value={availableCity}>{availableCity}</option>
              ))}
            </select>
            <select
              aria-label="Filter by property type"
              value={type}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "all" || value === "room" || value === "pg" || value === "flat") {
                  setType(value);
                  setOffset(0);
                }
              }}
              className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              <option value="all">All property types</option>
              <option value="room">Room</option>
              <option value="pg">PG</option>
              <option value="flat">Flat</option>
            </select>
            <select
              aria-label="Filter by listing status"
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "all" || value === "active" || value === "removed") {
                  setStatusFilter(value);
                  setOffset(0);
                }
              }}
              className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              <option value="all">All statuses</option>
              <option value="active">Public</option>
              <option value="removed">Restricted</option>
            </select>
            <Button type="submit" className="h-10 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
              Search
            </Button>
          </form>
        </Card>

        {successMessage && (
          <p role="status" aria-live="polite" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {successMessage}
          </p>
        )}
        {moderationMutation.isError && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Couldn&apos;t update the listing: {getErrorMessage(moderationMutation.error)}
          </p>
        )}
        {deletionMutation.isError && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Couldn&apos;t permanently delete the listing: {getErrorMessage(deletionMutation.error)}
          </p>
        )}

        {showDeletionHistory && (
          <section aria-label="Permanently deleted listings" className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950">
            <h2 className="font-semibold">Permanently deleted listings</h2>
            {deletionHistoryQuery.isLoading ? (
              <p role="status" className="mt-3 text-sm text-stone-500">Loading deletion history…</p>
            ) : deletionHistoryQuery.isError ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                Couldn&apos;t load deletion history: {getErrorMessage(deletionHistoryQuery.error)}{" "}
                <button type="button" className="font-semibold underline" onClick={() => void deletionHistoryQuery.refetch()}>Retry</button>
              </p>
            ) : deletionHistoryQuery.data?.length ? (
              <ul className="mt-3 divide-y divide-stone-200 dark:divide-stone-800">
                {deletionHistoryQuery.data.map((deletion) => (
                  <li key={deletion.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold">{deletion.property_title} · {deletion.city || "City not provided"}</p>
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                      Owner {deletion.owner_email} · Deleted by {deletion.admin_email} · {new Date(deletion.deleted_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">{deletion.reason}</p>
                    {deletion.moderation_history.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-semibold">Earlier moderation history ({deletion.moderation_history.length})</summary>
                        <ul className="mt-2 space-y-2 pl-4">
                          {deletion.moderation_history.map((action, index) => (
                            <li key={`${action.created_at}-${index}`}>
                              {action.status === "removed" ? "Restricted" : "Restored"} · {new Date(action.created_at).toLocaleString()}
                              {action.admin_email ? ` · ${action.admin_email}` : ""}
                              {action.reason ? ` · ${action.reason}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">No listings have been permanently deleted.</p>
            )}
          </section>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {listingsQuery.data?.total ?? 0} listing{listingsQuery.data?.total === 1 ? "" : "s"}
            {listingsQuery.isFetching && listingsQuery.data ? " · Updating…" : ""}
          </p>
          <p className="hidden text-xs text-stone-500 sm:block">Restrictions are reversible; owners can see the reason.</p>
        </div>

        {listingsQuery.isLoading ? (
          <div aria-label="Loading listings" className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />
            ))}
          </div>
        ) : listingsQuery.isError ? (
          <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-5 text-sm text-red-800">
            Couldn&apos;t load listings: {getErrorMessage(listingsQuery.error)}{" "}
            <button type="button" onClick={() => void listingsQuery.refetch()} className="font-semibold underline">Try again</button>
          </div>
        ) : listingsQuery.data?.items.length ? (
          <div className="mt-4 grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {listingsQuery.data.items.map((listing) => (
              <Card key={listing.id} className="overflow-hidden rounded-2xl border-stone-200 bg-white p-0 shadow-sm dark:border-stone-700 dark:bg-stone-950">
                <div className="grid grid-cols-[96px_minmax(0,1fr)]">
                  {listing.image_urls[0] ? (
                    <img src={listing.image_urls[0]} alt="" loading="lazy" className="h-28 w-full bg-stone-100 object-contain" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-emerald-50 text-emerald-800">
                      <Building2 size={24} />
                    </div>
                  )}
                  <div className="min-w-0 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">{listing.type}</p>
                        <h2 className="mt-0.5 line-clamp-1 text-sm font-semibold leading-snug">{listing.title}</h2>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        listing.status === "active"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      }`}>
                        {listing.status === "active" ? "Public" : "Restricted"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">₹{Number(listing.price).toLocaleString("en-IN")}<span className="font-normal"> / month</span></p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-stone-600 dark:text-stone-400">
                      {[listing.area, listing.city].filter(Boolean).join(", ") || "Location not provided"}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-stone-600 dark:text-stone-400">
                      {listing.owner_name || "Name not provided"} · {listing.owner_email}
                    </p>
                    {listing.status !== "active" && listing.moderation_reason && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                        <strong>Current restriction reason:</strong> {listing.moderation_reason}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {listing.status === "active" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-full border-amber-300 px-3 text-xs text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200"
                          onClick={() => {
                            setRemovalId(removalId === listing.id ? null : listing.id);
                            setRemovalReason("");
                            setDeletionId(null);
                            moderationMutation.reset();
                            deletionMutation.reset();
                          }}
                        >
                          Restrict listing
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled={moderationMutation.isPending}
                          onClick={() => moderationMutation.mutate({ id: listing.id, status: "active" })}
                          className="h-9 rounded-full bg-emerald-700 px-3 text-xs text-white hover:bg-emerald-800"
                        >
                          {moderationMutation.isPending && moderationMutation.variables?.id === listing.id && <Loader2 size={14} className="animate-spin" />}
                          Restore listing
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full px-3 text-xs"
                        onClick={() => setHistoryListingId(historyListingId === listing.id ? null : listing.id)}
                      >
                        {historyListingId === listing.id ? "Hide history" : "Moderation history"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full border-red-300 px-3 text-xs text-red-800 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                        onClick={() => {
                        setDeletionId(deletionId === listing.id ? null : listing.id);
                        setDeletionReason("");
                        setDeletionConfirmation("");
                        setRemovalId(null);
                        deletionMutation.reset();
                        moderationMutation.reset();
                        }}
                      >
                        Permanently delete
                      </Button>
                    </div>
                    {historyListingId === listing.id && (
                      <div className="mt-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">Moderation history</h3>
                        {historyQuery.isLoading ? (
                          <p role="status" className="mt-2 text-xs text-stone-500">Loading history…</p>
                        ) : historyQuery.isError ? (
                          <p role="alert" className="mt-2 text-xs text-red-700">
                            Couldn&apos;t load history: {getErrorMessage(historyQuery.error)}{" "}
                            <button type="button" className="font-semibold underline" onClick={() => void historyQuery.refetch()}>Retry</button>
                          </p>
                        ) : historyQuery.data?.length ? (
                          <ul className="mt-2 space-y-3">
                            {historyQuery.data.map((action, index) => (
                              <li key={`${action.created_at}-${index}`} className="border-t border-stone-100 pt-2 text-xs leading-5 first:border-0 first:pt-0 dark:border-stone-800">
                                <p className="font-semibold">{action.status === "removed" ? "Restricted" : "Restored"} · {new Date(action.created_at).toLocaleString()}</p>
                                {action.admin_email && <p>By {action.admin_email}</p>}
                                {action.reason && <p>{action.reason}</p>}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-stone-500">No prior moderation actions.</p>
                        )}
                      </div>
                    )}
                    {removalId === listing.id && listing.status === "active" && (
                      <form
                        className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30"
                        onSubmit={(event) => {
                          event.preventDefault();
                          moderationMutation.mutate({
                            id: listing.id,
                            status: "removed",
                            reason: removalReason.trim(),
                          });
                        }}
                      >
                        <label htmlFor={`reason-${listing.id}`} className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          Reason shown to the owner
                        </label>
                        <Textarea
                          id={`reason-${listing.id}`}
                          value={removalReason}
                          onChange={(event) => setRemovalReason(event.target.value)}
                          minLength={10}
                          maxLength={1000}
                          required
                          rows={3}
                          placeholder="Explain what needs to be corrected or why this listing is restricted."
                          className="mt-2 bg-white dark:bg-stone-950"
                        />
                        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                          The listing will disappear from public search. The owner will see this reason in their account.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setRemovalId(null)} className="h-9 rounded-full">
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={moderationMutation.isPending || removalReason.trim().length < 10}
                            className="h-9 rounded-full bg-amber-800 px-4 text-white hover:bg-amber-900"
                          >
                            {moderationMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                            Confirm restriction
                          </Button>
                        </div>
                      </form>
                    )}
                    {deletionId === listing.id && (
                      <form
                        className="mt-3 rounded-2xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900 dark:bg-red-950/30"
                        onSubmit={(event) => {
                          event.preventDefault();
                          deletionMutation.mutate({
                            id: listing.id,
                            reason: deletionReason.trim(),
                          });
                        }}
                      >
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                          Permanently delete this listing?
                        </p>
                        <p className="mt-1 text-xs leading-5 text-red-900 dark:text-red-200">
                          This removes the listing, its photos, saved links, and reports. It cannot be restored. The owner will retain this reason in their account, and the admin audit record will be kept.
                        </p>
                        <label htmlFor={`delete-reason-${listing.id}`} className="mt-3 block text-sm font-semibold">
                          Reason shown to the owner
                        </label>
                        <Textarea
                          id={`delete-reason-${listing.id}`}
                          value={deletionReason}
                          onChange={(event) => setDeletionReason(event.target.value)}
                          minLength={10}
                          maxLength={1000}
                          required
                          rows={2}
                          placeholder="Explain why this listing is being permanently deleted."
                          className="mt-2 bg-white dark:bg-stone-950"
                        />
                        <label htmlFor={`delete-confirm-${listing.id}`} className="mt-3 block text-xs font-semibold">
                          Type DELETE to confirm
                        </label>
                        <Input
                          id={`delete-confirm-${listing.id}`}
                          value={deletionConfirmation}
                          onChange={(event) => setDeletionConfirmation(event.target.value)}
                          autoComplete="off"
                          className="mt-1 h-9 bg-white dark:bg-stone-950"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeletionId(null)}
                            className="h-9 rounded-full"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={
                              deletionMutation.isPending ||
                              deletionReason.trim().length < 10 ||
                              deletionConfirmation.trim() !== "DELETE"
                            }
                            className="h-9 rounded-full bg-red-700 px-4 text-white hover:bg-red-800"
                          >
                            {deletionMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                            Confirm permanent deletion
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center dark:border-stone-700 dark:bg-stone-950">
            <Building2 className="mx-auto text-stone-400" size={30} />
            <h2 className="mt-3 font-semibold">No listings match these filters</h2>
            <p className="mt-1 text-sm text-stone-500">Try another city, status or search term.</p>
          </div>
        )}

        {listingsQuery.data && listingsQuery.data.total > PAGE_SIZE && (
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-950">
            <Button type="button" variant="outline" disabled={offset === 0 || listingsQuery.isFetching} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="rounded-xl">
              <ArrowLeft /> Previous
            </Button>
            <span className="text-sm text-stone-600 dark:text-stone-300">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, listingsQuery.data.total)} of {listingsQuery.data.total}
            </span>
            <Button type="button" variant="outline" disabled={offset + PAGE_SIZE >= listingsQuery.data.total || listingsQuery.isFetching} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="rounded-xl">
              Next <ArrowRight />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
