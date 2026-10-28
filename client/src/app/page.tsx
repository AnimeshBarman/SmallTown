"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Heart, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

type PropertySummary = {
  id: string;
  title: string;
  area?: string | null;
  type: string;
  price: number;
  image_urls?: string[];
};
type PropertyPage = { items: PropertySummary[]; total: number; limit: number; offset: number };

export default function Home() {
  const { data: pageData, isLoading, isError, refetch } = useQuery<PropertyPage>({
    queryKey: ["properties", "Cooch Behar", "home"],
    queryFn: async () => {
      const { data } = await api.get<PropertyPage>("/properties/", {
        params: { city: "Cooch Behar", limit: 4, offset: 0 },
        timeout: 10000,
      });
      return data;
    },
    retry: false,
    staleTime: 60_000,
  });
  const listings = pageData?.items ?? [];

  return (
    <main className="flex-1 bg-[#faf9f6] text-stone-900">
      <section className="relative overflow-hidden bg-[#163d32] text-white">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/4 h-96 w-96 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-emerald-50">
              <MapPin size={15} /> Made for Cooch Behar
            </div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Find a place
              <span className="block font-serif italic text-lime-200">that feels like yours.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-emerald-50/80 sm:text-lg">
              Local rooms, PGs and homes. Clear prices, real locations, and no endless scrolling.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-lime-200 px-6 font-semibold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-lime-100"
              >
                Explore homes <ArrowRight size={17} />
              </Link>
              <Link
                href="/properties/new"
                className="inline-flex h-12 items-center rounded-full border border-white/30 px-6 font-medium text-white transition hover:bg-white/10"
              >
                List your place
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-emerald-50/75">
              <span className="flex items-center gap-2"><ShieldCheck size={16} /> Direct from owners</span>
              <span className="flex items-center gap-2"><Heart size={16} /> Save your favourites</span>
              <span className="flex items-center gap-2"><BadgeCheck size={16} /> Simple and local</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -left-5 top-10 z-10 rounded-2xl bg-white p-3 text-stone-800 shadow-xl sm:-left-10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-100 text-emerald-800">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Your next chapter</p>
                  <p className="text-xs text-stone-500">could start right here</p>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur">
              {listings[0]?.image_urls?.[0] ? (
                <img
                  src={listings[0].image_urls[0]}
                  alt={listings[0].title}
                  className="h-80 w-full rounded-[1.5rem] object-cover sm:h-96"
                  fetchPriority="high"
                />
              ) : (
                <div className="flex h-80 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-emerald-200 via-lime-100 to-amber-100 sm:h-96">
                  <BuildingIllustration />
                </div>
              )}
              {listings[0] && (
                <div className="flex items-center justify-between gap-3 px-3 py-4 text-white">
                  <div>
                    <p className="font-semibold">{listings[0].title}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-white/70">
                      <MapPin size={14} /> {listings[0].area || "Cooch Behar"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">₹{Number(listings[0].price).toLocaleString("en-IN")}<span className="text-xs font-normal text-white/70"> /mo</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">A good place to begin</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Places around Cooch Behar</h2>
            <p className="mt-2 text-stone-600">A few handpicked stays to get you started.</p>
          </div>
          <Link href="/explore" className="inline-flex items-center gap-2 font-semibold text-emerald-800 hover:text-emerald-950">
            View all stays <ArrowRight size={17} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-stone-200" />)}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            Couldn&apos;t load local places right now.
            <button type="button" onClick={() => void refetch()} className="ml-2 font-semibold underline">Try again</button>
          </div>
        ) : listings.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((listing) => (
              <Card
                key={listing.id}
                className="group overflow-hidden rounded-3xl border border-stone-200 bg-white p-0 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <Link href={`/explore?property=${listing.id}`}>
                  {listing.image_urls?.[0] ? (
                    <img src={listing.image_urls[0]} alt={listing.title} loading="lazy" className="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-gradient-to-br from-emerald-100 to-lime-50 text-emerald-800"><BuildingIllustration /></div>
                  )}
                  <div className="p-4">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-800">{listing.type}</span>
                    <h3 className="mt-3 truncate font-semibold">{listing.title}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-stone-500"><MapPin size={14} />{listing.area || "Cooch Behar"}</p>
                    <p className="mt-3 font-semibold text-emerald-800">₹{Number(listing.price).toLocaleString("en-IN")}<span className="text-sm font-normal text-stone-500"> / month</span></p>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
            <h3 className="font-semibold">The first local listings are on their way</h3>
            <p className="mt-1 text-sm text-stone-500">If you have a place in Cooch Behar, help someone find their next home.</p>
            <Link href="/properties/new" className="mt-4 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800">List a place</Link>
          </div>
        )}
      </section>
    </main>
  );
}

function BuildingIllustration() {
  return (
    <div className="relative h-44 w-52">
      <div className="absolute bottom-1 left-4 h-28 w-36 rounded-t-2xl bg-[#163d32] shadow-lg">
        <div className="absolute -top-8 left-0 h-0 w-0 border-x-[4.5rem] border-b-[2.25rem] border-x-transparent border-b-[#c17a51]" />
        <div className="absolute left-5 top-7 grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, index) => <span key={index} className="h-5 w-5 rounded-sm bg-lime-200/90" />)}
        </div>
        <div className="absolute bottom-0 right-5 h-12 w-7 rounded-t-md bg-[#c17a51]" />
      </div>
      <span className="absolute bottom-1 right-2 h-16 w-3 rounded-full bg-emerald-800" />
      <span className="absolute bottom-14 right-0 h-14 w-14 rounded-full bg-emerald-700" />
    </div>
  );
}
