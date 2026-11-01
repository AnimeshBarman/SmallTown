"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeToAuth } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ReportStatus = "open" | "resolved" | "dismissed" | "all";
type ListingReport = {
  id: string;
  property_id: string;
  property_title: string;
  property_area: string | null;
  property_city: string | null;
  reporter_email: string;
  reason: "suspicious" | "inaccurate" | "inappropriate" | "other";
  details: string | null;
  status: Exclude<ReportStatus, "all">;
  created_at: string;
  reviewed_at: string | null;
  resolution_note: string | null;
};
type Profile = { role: string };

const reasonLabels: Record<ListingReport["reason"], string> = {
  suspicious: "Suspicious or possibly fraudulent",
  inaccurate: "Inaccurate or unavailable",
  inappropriate: "Inappropriate content",
  other: "Other",
};

function errorMessage(error: unknown) {
  if (isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AdminReportsPage() {
  const queryClient = useQueryClient();
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>("open");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const profileQuery = useQuery<Profile>({
    queryKey: ["profile"],
    enabled: signedIn,
    queryFn: async () => (await api.get<Profile>("/auth/me")).data,
  });
  const reportsQuery = useQuery<ListingReport[]>({
    queryKey: ["moderation", "reports", statusFilter],
    enabled: signedIn && profileQuery.data?.role === "admin",
    queryFn: async () => (
      await api.get<ListingReport[]>("/moderation/reports", {
        params: { status: statusFilter, limit: 200 },
      })
    ).data,
  });
  const reviewMutation = useMutation({
    mutationFn: async (input: { id: string; status: "resolved" | "dismissed"; removeListing?: boolean }) =>
      api.patch(`/moderation/reports/${input.id}`, {
        status: input.status,
        resolution_note: resolutionNotes[input.id]?.trim() || undefined,
        remove_listing: input.removeListing ?? false,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });

  if (!signedIn) {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center dark:border-stone-700 dark:bg-stone-950">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-300">Sign in with an administrator account to review listing reports.</p>
          <Link className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 font-semibold text-white" href="/login?next=%2Fadmin%2Freports">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <div aria-label="Checking administrator access" className="mx-auto h-40 max-w-3xl animate-pulse rounded-3xl bg-stone-200 dark:bg-stone-800" />
      </main>
    );
  }

  if (profileQuery.isError) {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <div role="alert" className="mx-auto max-w-3xl rounded-2xl bg-red-50 p-5 text-red-800">
          Couldn&apos;t verify administrator access: {errorMessage(profileQuery.error)}
        </div>
      </main>
    );
  }

  if (profileQuery.data?.role !== "admin") {
    return (
      <main className="flex-1 bg-[#faf9f6] px-4 py-12 dark:bg-stone-900">
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center dark:border-stone-700 dark:bg-stone-950">
          <ShieldCheck className="mx-auto text-emerald-700 dark:text-emerald-300" size={30} />
          <h1 className="mt-4 text-2xl font-semibold">Administrator access only</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-300">This review queue is only available to SmallTown administrators.</p>
          <Link href="/account" className="mt-5 inline-flex rounded-full border border-stone-300 px-5 py-2.5 font-semibold dark:border-stone-600">
            Back to account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-[#faf9f6] px-4 py-8 text-stone-900 dark:bg-stone-900 dark:text-stone-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <ArrowLeft size={16} /> Back to admin panel
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={17} /> Moderation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Listing reports</h1>
            <p className="mt-2 text-stone-600 dark:text-stone-300">Review user reports and record the outcome.</p>
          </div>
          <label className="text-sm font-medium">
            Filter
            <select
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "open" || value === "resolved" || value === "dismissed" || value === "all") {
                  setStatusFilter(value);
                }
              }}
              className="ml-2 h-10 rounded-xl border border-stone-300 bg-white px-3 dark:border-stone-700 dark:bg-stone-950"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All reports</option>
            </select>
          </label>
        </div>

        {reviewMutation.isError && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Couldn&apos;t update the report: {errorMessage(reviewMutation.error)}
          </p>
        )}

        {reportsQuery.isLoading ? (
          <div aria-label="Loading reports" className="mt-6 space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />
            ))}
          </div>
        ) : reportsQuery.isError ? (
          <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-800">
            Couldn&apos;t load reports: {errorMessage(reportsQuery.error)}{" "}
            <button type="button" onClick={() => void reportsQuery.refetch()} className="font-semibold underline">Try again</button>
          </div>
        ) : reportsQuery.data?.length ? (
          <div className="mt-6 space-y-4">
            {reportsQuery.data.map((report) => (
              <Card key={report.id} className="rounded-2xl border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-950 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                      <Flag size={16} /> {reasonLabels[report.reason]}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">{report.property_title}</h2>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                      {report.property_area ? `${report.property_area}, ` : ""}{report.property_city || "Location not provided"}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    report.status === "open"
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      : report.status === "resolved"
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                  }`}>
                    {report.status}
                  </span>
                </div>
                {report.details && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-sm leading-6 dark:bg-stone-900">{report.details}</p>}
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
                  <span>Reported by {report.reporter_email}</span>
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                  <Link href={`/explore?property=${report.property_id}`} className="font-semibold text-emerald-800 underline dark:text-emerald-300">
                    Open listing
                  </Link>
                </div>
                {report.status === "open" ? (
                  <div className="mt-5 border-t border-stone-200 pt-4 dark:border-stone-800">
                    <label htmlFor={`resolution-${report.id}`} className="text-sm font-medium">Review note <span className="font-normal text-stone-500">(optional)</span></label>
                    <Textarea
                      id={`resolution-${report.id}`}
                      value={resolutionNotes[report.id] ?? ""}
                      onChange={(event) => setResolutionNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                      maxLength={1000}
                      rows={2}
                      placeholder="Record what you checked or why the report was dismissed."
                      className="mt-2"
                    />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: report.id, status: "dismissed" })}
                        className="rounded-full"
                      >
                        Dismiss report
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={reviewMutation.isPending || (resolutionNotes[report.id]?.trim().length ?? 0) < 10}
                        onClick={() => {
                          if (window.confirm(`Remove “${report.property_title}” from public listings and resolve this report?`)) {
                            reviewMutation.mutate({
                              id: report.id,
                              status: "resolved",
                              removeListing: true,
                            });
                          }
                        }}
                        className="rounded-full"
                      >
                        Remove listing
                      </Button>
                      <Button
                        type="button"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: report.id, status: "resolved" })}
                        className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                      >
                        {reviewMutation.isPending && reviewMutation.variables?.id === report.id && <Loader2 size={16} className="animate-spin" />}
                        Mark reviewed
                      </Button>
                    </div>
                    <p className="mt-2 text-right text-xs text-stone-500">
                      To remove the listing, enter at least 10 characters explaining the reason.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
                    {report.status === "resolved" ? "Marked reviewed" : "Dismissed"}
                    {report.reviewed_at ? ` · ${new Date(report.reviewed_at).toLocaleString()}` : ""}
                    {report.resolution_note ? ` · ${report.resolution_note}` : ""}
                  </p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center dark:border-stone-700 dark:bg-stone-950">
            <Flag className="mx-auto text-stone-400" size={28} />
            <p className="mt-3 font-semibold">No {statusFilter === "all" ? "" : `${statusFilter} `}reports</p>
            <p className="mt-1 text-sm text-stone-500">New reports will appear here for review.</p>
          </div>
        )}
      </div>
    </main>
  );
}
