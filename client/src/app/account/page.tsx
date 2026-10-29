"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Eye, Heart, Home, Loader2, LogOut, MapPin, Pencil, Trash2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { formatPostedAgo } from "@/lib/relative-time";
import { getAuthSnapshot, getServerAuthSnapshot, notifyAuthChanged, subscribeToAuth } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Profile = {
  fullname: string | null;
  email: string;
  phone: string | null;
};

type Listing = {
  id: string;
  title: string;
  city?: string | null;
  area?: string | null;
  type: string;
  price: number;
  image_urls?: string[];
  view_count: number;
  created_at: string;
};

function messageFromError(error: unknown) {
  if (isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const profileQuery = useQuery<Profile>({
    queryKey: ["profile"],
    enabled: signedIn,
    queryFn: async () => (await api.get<Profile>("/auth/me")).data,
  });
  const listingsQuery = useQuery<Listing[]>({
    queryKey: ["properties", "mine"],
    enabled: signedIn,
    queryFn: async () => (await api.get<Listing[]>("/properties/mine")).data,
  });
  const savedQuery = useQuery<Listing[]>({
    queryKey: ["properties", "saved"],
    enabled: signedIn,
    queryFn: async () => (await api.get<Listing[]>("/properties/saved")).data,
  });

  const profileMutation = useMutation({
    mutationFn: async (profile: { fullname: string }) =>
      api.patch<Profile>("/auth/me", profile),
    onSuccess: async ({ data }) => {
      queryClient.setQueryData(["profile"], data);
      setNotice("Your profile has been updated.");
      setErrorMessage("");
    },
    onError: (error: unknown) => {
      setErrorMessage(messageFromError(error));
      setNotice("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/properties/${id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["properties", "mine"] }),
        queryClient.invalidateQueries({ queryKey: ["properties"] }),
        queryClient.invalidateQueries({ queryKey: ["properties", "saved"] }),
      ]);
    },
    onError: (error: unknown) => setErrorMessage(messageFromError(error)),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => api.post("/auth/logout"),
    onSuccess: () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      notifyAuthChanged();
      router.replace("/");
    },
    onError: () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      notifyAuthChanged();
      router.replace("/login?logout=failed");
    },
  });

  if (!signedIn) {
    return (
      <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-[#faf9f6] px-4">
        <section className="max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto text-emerald-700" size={32} />
          <h1 className="mt-4 text-2xl font-semibold">Your account, all in one place</h1>
          <p className="mt-2 text-sm text-stone-600">Sign in to update your profile, manage listings and see saved places.</p>
          <Link href="/login?next=%2Faccount" className="mt-6 inline-flex rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">Sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex-1 bg-[#faf9f6] px-4 py-8 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Your SmallTown</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Account & places</h1>
          <p className="mt-2 text-stone-600">Keep your details current, manage your listings, and revisit saved homes.</p>
        </div>

        {errorMessage && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</div>}
        {notice && <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <Card className="h-fit rounded-3xl border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <CardHeader className="mb-5 flex flex-row items-center gap-3 p-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-800"><UserRound size={20} /></span>
              <div>
                <CardTitle className="text-lg font-semibold">Profile details</CardTitle>
                <p className="text-sm text-stone-500">Update your account information</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
            {profileQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-700" /></div>
            ) : profileQuery.isError ? (
              <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                Couldn&apos;t load your profile. <button onClick={() => void profileQuery.refetch()} className="font-semibold underline">Try again</button>
              </div>
            ) : (
              <form
                key={profileQuery.data?.email}
                className="space-y-4"
                onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  setErrorMessage("");
                  setNotice("");
                  const formData = new FormData(event.currentTarget);
                  profileMutation.mutate({ fullname: String(formData.get("fullname") || "") });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="fullname">Full name</Label>
                  <Input id="fullname" name="fullname" defaultValue={profileQuery.data?.fullname || ""} minLength={2} maxLength={100} required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profileQuery.data?.email || ""} readOnly className="h-11 bg-stone-50 text-stone-500" />
                </div>
                <Button type="submit" disabled={profileMutation.isPending} className="h-11 w-full rounded-full bg-emerald-700 font-semibold text-white transition hover:bg-emerald-800">
                  {profileMutation.isPending && <Loader2 size={16} className="animate-spin" />} Save profile
                </Button>
              </form>
            )}
              <Button
                type="button"
                variant="outline"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                className="mt-3 h-11 w-full rounded-full border-stone-300 text-stone-700 hover:bg-stone-100"
              >
                {logoutMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                Log out
              </Button>
            </CardContent>
          </Card>

          <Card id="listings" className="rounded-3xl border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <CardHeader className="mb-5 flex flex-row flex-wrap items-center justify-between gap-3 p-0">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-800"><Home size={20} /></span>
                <div>
                  <CardTitle className="text-lg font-semibold">Your listings</CardTitle>
                  <p className="text-sm text-stone-500">View interest and manage your places</p>
                </div>
              </div>
              <Button type="button" onClick={() => router.push("/properties/new")} variant="outline" className="h-10 rounded-full border-emerald-700 text-emerald-800 hover:bg-emerald-50">+ Add listing</Button>
            </CardHeader>
            {listingsQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-700" /></div>
            ) : listingsQuery.isError ? (
              <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                Couldn&apos;t load your listings. <button onClick={() => void listingsQuery.refetch()} className="font-semibold underline">Try again</button>
              </div>
            ) : listingsQuery.data?.length ? (
              <div className="space-y-3">
                {listingsQuery.data.map((listing) => (
                  <article key={listing.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-3 sm:gap-4">
                    {listing.image_urls?.[0] ? <img src={listing.image_urls[0]} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Home size={22} /></div>}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{listing.title}</h3>
                      <p className="mt-1 flex items-center gap-1 truncate text-sm text-stone-500"><MapPin size={13} />{listing.area || listing.city || "Cooch Behar"}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-stone-500"><Eye size={14} />{listing.view_count} views</p>
                      <p className="mt-1 text-xs text-stone-500">Posted {formatPostedAgo(listing.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="font-semibold text-emerald-800">₹{Number(listing.price).toLocaleString("en-IN")}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/properties/${listing.id}/edit`)}
                        className="h-8 rounded-full px-3 text-xs"
                      >
                        <Pencil size={14} /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${listing.title}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete “${listing.title}”? This cannot be undone.`)) {
                            deleteMutation.mutate(listing.id);
                          }
                        }}
                        className="h-8 rounded-full px-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-stone-50 px-5 py-8 text-center">
                <p className="font-medium">You haven&apos;t listed a place yet.</p>
                <Link href="/properties/new" className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline">Create your first listing</Link>
              </div>
            )}
          </Card>
        </div>

        <Card id="saved" className="mt-6 rounded-3xl border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <CardHeader className="mb-5 flex flex-row items-center gap-3 p-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-700"><Heart size={20} /></span>
            <div>
              <CardTitle className="text-lg font-semibold">Saved places</CardTitle>
              <p className="text-sm text-stone-500">Your shortlist, all in one place</p>
            </div>
          </CardHeader>
          {savedQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-emerald-700" /></div>
          ) : savedQuery.isError ? (
            <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
              Couldn&apos;t load saved places. <button onClick={() => void savedQuery.refetch()} className="font-semibold underline">Try again</button>
            </div>
          ) : savedQuery.data?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedQuery.data.map((listing) => (
                <Card key={listing.id} className="group overflow-hidden rounded-2xl border border-stone-200 p-0 transition hover:shadow-lg">
                  <Link href={`/explore?property=${listing.id}`}>
                  {listing.image_urls?.[0] ? <img src={listing.image_urls[0]} alt={listing.title} loading="lazy" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center bg-emerald-50 text-emerald-800"><Heart size={24} /></div>}
                  <div className="p-4">
                    <h3 className="truncate font-semibold group-hover:text-emerald-800">{listing.title}</h3>
                    <p className="mt-1 text-sm text-stone-500">{listing.area || listing.city || "Cooch Behar"}</p>
                    <p className="mt-3 font-semibold text-emerald-800">₹{Number(listing.price).toLocaleString("en-IN")}<span className="text-xs font-normal text-stone-500"> / month</span></p>
                  </div>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-stone-50 px-5 py-8 text-center text-sm text-stone-500">Tap the heart on a listing to save it for later.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
