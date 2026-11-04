"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, ArrowRight, BedDouble, ChevronLeft, ChevronRight, Flag, Heart, Loader2, LocateFixed, MapPin, Phone, Search, ShieldCheck, Sparkles, X,
  ZoomIn, ZoomOut,
} from "lucide-react";
import { api } from "@/lib/api";
import { getCurrentCoordinates } from "@/lib/geolocation";
import { formatPostedAgo } from "@/lib/relative-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PropertyPhotoViewer from "@/components/PropertyPhotoViewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  clearCreatedListing,
  getCreatedListingSnapshot,
  getServerCreatedListingSnapshot,
  subscribeToCreatedListing,
} from "@/lib/listing-created";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeToAuth } from "@/lib/auth-state";
import {
  getSelectedPropertySnapshot,
  getServerSelectedPropertySnapshot,
  setSelectedProperty,
  subscribeToSelectedProperty,
} from "@/lib/selected-property";

const PAGE_SIZE = 12;
type ListingSort = "newest" | "oldest" | "price_asc";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), {
  ssr: false,
  loading: () => <div aria-label="Loading map" className="h-96 animate-pulse rounded-3xl bg-stone-100 dark:bg-stone-900" />,
});

type PropertySummary = {
  id: string;
  title: string;
  area?: string | null;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  type: string;
  price: number;
  image_urls?: string[];
  is_verified?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  view_count?: number;
  owner_name?: string | null;
  created_at?: string;
};

type PropertyDetail = PropertySummary;
type ListingReportReason = "suspicious" | "inaccurate" | "inappropriate" | "other";
type City = { id: string; name: string; state?: string | null };
type PropertyPage = { items: PropertySummary[]; total: number; limit: number; offset: number };
type LegacyPropertyPage = PropertySummary[];

function createVisitorId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getSearchErrorMessage(error: unknown) {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item && typeof item === "object" && "msg" in item ? item.msg : null)
        .filter((message): message is string => typeof message === "string");
      if (messages.length) return messages.join("; ");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Natural-language search is temporarily unavailable.";
}

export default function ExplorePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [city, setCity] = useState("Cooch Behar");
  const [sort, setSort] = useState<ListingSort>("newest");
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ListingReportReason>("suspicious");
  const [reportDetails, setReportDetails] = useState("");
  const [revealedContact, setRevealedContact] = useState<{
    propertyId: string;
    phone: string | null;
  } | null>(null);
  const [photoSelection, setPhotoSelection] = useState<{ propertyId: string | null; index: number }>({
    propertyId: null,
    index: 0,
  });
  const [photoZoom, setPhotoZoom] = useState<{ propertyId: string | null; index: number; scale: number }>({
    propertyId: null,
    index: 0,
    scale: 1,
  });
  const [photoPan, setPhotoPan] = useState<{ propertyId: string | null; index: number; x: number; y: number }>({
    propertyId: null,
    index: 0,
    x: 0,
    y: 0,
  });
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);
  const photoDragStart = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  const photoTouchStartX = useRef<number | null>(null);
  const createdPropertyId = useSyncExternalStore(
    subscribeToCreatedListing,
    getCreatedListingSnapshot,
    getServerCreatedListingSnapshot
  );
  const selectedId = useSyncExternalStore(
    subscribeToSelectedProperty,
    getSelectedPropertySnapshot,
    getServerSelectedPropertySnapshot
  );
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ["cities"],
    queryFn: async () => (await api.get<City[]>("/properties/cities")).data,
    staleTime: 5 * 60 * 1000,
  });

  const propertiesQuery = useQuery<PropertyPage>({
    queryKey: ["properties", city, sort, page],
    queryFn: async () => {
      const { data } = await api.get<PropertyPage | LegacyPropertyPage>("/properties/", {
        params: { city, sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        timeout: 10000,
      });
      if (Array.isArray(data)) {
        return {
          items: data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
          total: data.length,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        };
      }
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const properties = propertiesQuery.data?.items ?? [];
  const totalPages = Math.ceil((propertiesQuery.data?.total ?? 0) / PAGE_SIZE);

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await api.post<PropertySummary[]>("/search/nlp", { query }, {
        params: { city, limit: 24 },
        timeout: 20000,
      });
      return data;
    },
  });
  const nearbySearchMutation = useMutation({
    mutationFn: async () => {
      const [latitude, longitude] = await getCurrentCoordinates();
      const { data } = await api.post<PropertySummary[]>("/search/nearby", {
        latitude,
        longitude,
      }, {
        params: { limit: 24 },
        timeout: 10000,
      });
      return data;
    },
  });
  const displayedProperties = nearbySearchMutation.isSuccess
    ? nearbySearchMutation.data
    : searchMutation.isSuccess
      ? searchMutation.data
      : properties;
  const sortedDisplayedProperties = nearbySearchMutation.isSuccess
    ? displayedProperties
    : searchMutation.isSuccess
      ? [...displayedProperties].sort((a, b) => {
          if (sort === "price_asc") return Number(a.price) - Number(b.price);
          const dateDifference =
            new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
          return sort === "oldest" ? dateDifference : -dateDifference;
        })
      : displayedProperties;

  const detailQuery = useQuery<PropertyDetail>({
    queryKey: ["property", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data } = await api.get<PropertyDetail>(`/properties/${selectedId}`);
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const savedQuery = useQuery<{ saved: boolean }>({
    queryKey: ["property-saved", selectedId],
    enabled: signedIn && Boolean(selectedId),
    queryFn: async () => (await api.get(`/properties/${selectedId}/saved`)).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      if (savedQuery.data?.saved) {
        await api.delete(`/properties/${selectedId}/save`);
      } else {
        await api.post(`/properties/${selectedId}/save`);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["property-saved", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["properties", "saved"] }),
      ]);
    },
  });

  const contactRevealMutation = useMutation({
    mutationFn: async (propertyId: string) => (
      await api.get<{ contact_phone: string | null }>(`/properties/${propertyId}/contact`)
    ).data,
    onSuccess: (contact, propertyId) => {
      setRevealedContact({ propertyId, phone: contact.contact_phone });
    },
  });
  const resetContactRevealMutation = contactRevealMutation.reset;

  const reportMutation = useMutation({
    mutationFn: async (report: {
      propertyId: string;
      reason: ListingReportReason;
      details: string;
    }) => api.post(`/properties/${report.propertyId}/reports`, {
      reason: report.reason,
      details: report.details.trim() || undefined,
    }),
    onSuccess: async () => {
      setReportDetails("");
      await queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });

  const resetReportMutation = reportMutation.reset;
  const closePropertyDetails = useCallback(() => {
    setPhotoViewerIndex(null);
    setReportOpen(false);
    setReportDetails("");
    resetReportMutation();
    resetContactRevealMutation();
    setRevealedContact(null);
    setSelectedProperty(null);
  }, [resetContactRevealMutation, resetReportMutation]);

  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (photoViewerIndex !== null) {
        setPhotoViewerIndex(null);
      } else {
        closePropertyDetails();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedId, photoViewerIndex, closePropertyDetails]);

  useEffect(() => {
    if (!selectedId) return;
    let visitorId = localStorage.getItem("smalltown_visitor_id");
    if (!visitorId) {
      visitorId = createVisitorId();
      localStorage.setItem("smalltown_visitor_id", visitorId);
    }

    void api.post(`/properties/${selectedId}/view`, null, {
      headers: { "X-Visitor-ID": visitorId },
    }).catch((error: unknown) => {
      console.error("Could not record listing view.", error);
    });
  }, [selectedId]);

  const warmPropertyDetails = (property: PropertySummary) => {
    void queryClient.prefetchQuery({
      queryKey: ["property", property.id],
      queryFn: async () => (await api.get<PropertyDetail>(`/properties/${property.id}`)).data,
      staleTime: 2 * 60 * 1000,
    });
  };

  const openProperty = (property: PropertySummary) => {
    if (!queryClient.getQueryData<PropertyDetail>(["property", property.id])) {
      queryClient.setQueryData<PropertyDetail>(
        ["property", property.id],
        { ...property },
        { updatedAt: 0 },
      );
    }
    setSelectedProperty(property.id);
  };

  const mapProperties = displayedProperties.filter(
    (property): property is PropertySummary & { latitude: number; longitude: number } =>
      typeof property.latitude === "number" &&
      Number.isFinite(property.latitude) &&
      property.latitude >= -90 &&
      property.latitude <= 90 &&
      typeof property.longitude === "number" &&
      Number.isFinite(property.longitude) &&
      property.longitude >= -180 &&
      property.longitude <= 180
  );
  const detail = detailQuery.data;
  const detailImages = detail?.image_urls ?? [];
  const activePhotoIndex = photoSelection.propertyId === selectedId ? photoSelection.index : 0;
  const activeImageIndex = detailImages.length
    ? Math.min(activePhotoIndex, detailImages.length - 1)
    : 0;
  const activePhotoZoom =
    photoZoom.propertyId === selectedId && photoZoom.index === activePhotoIndex ? photoZoom.scale : 1;
  const activePhotoPan =
    photoPan.propertyId === selectedId && photoPan.index === activePhotoIndex
      ? photoPan
      : { x: 0, y: 0 };
  const detailHasCoordinates =
    typeof detail?.latitude === "number" &&
    typeof detail.longitude === "number" &&
    Number.isFinite(detail.latitude) &&
    Number.isFinite(detail.longitude);

  return (
    <main className="min-h-screen flex-1 bg-[#faf9f6] px-4 py-4 text-stone-900 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 sm:block">Find your next place</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:mt-1 sm:text-4xl">Stay awhile, feel at home.</h1>
            <p className="mt-1 hidden text-sm text-stone-600 sm:block">Thoughtful local listings, starting in Cooch Behar.</p>
          </div>
          <div className="w-full rounded-2xl border border-stone-200 bg-white p-2 shadow-sm sm:w-56">
            <label htmlFor="explore-city" className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              <MapPin size={13} className="text-emerald-700" />
              Search location
            </label>
            <Select value={city} onValueChange={(value) => {
              if (!value) return;
              setCity(value);
              setPage(0);
              searchMutation.reset();
              nearbySearchMutation.reset();
            }}>
              <SelectTrigger id="explore-city" aria-label="Choose a city" className="h-10 w-full rounded-xl border-stone-200 bg-stone-50 px-3 font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                <SelectValue placeholder="Choose a city" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="min-w-52">
                {(cities.length ? cities : [{ id: "cooch-behar", name: "Cooch Behar" }]).map((option) => (
                  <SelectItem key={option.id} value={option.name} className="min-h-10">{option.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="mb-4 rounded-2xl border-emerald-100 bg-linear-to-r from-emerald-50 via-white to-lime-50 p-2.5 shadow-sm dark:border-stone-700 dark:bg-none dark:bg-stone-900 sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const query = searchText.trim();
                if (query.length < 5) return;
                nearbySearchMutation.reset();
                searchMutation.mutate(query);
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    if (searchMutation.isSuccess || searchMutation.isError) searchMutation.reset();
                    if (nearbySearchMutation.isSuccess || nearbySearchMutation.isError) nearbySearchMutation.reset();
                  }}
                  aria-label="Describe the place you want"
                  placeholder="Try “PG under ₹8,000 near college”"
                  minLength={5}
                  maxLength={200}
                  className="h-10 rounded-xl border-emerald-100 bg-white pl-9 text-sm text-stone-900 placeholder:text-stone-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 sm:text-base"
                />
              </div>
              <Button
                type="submit"
                disabled={searchMutation.isPending || searchText.trim().length < 5}
                className="h-10 shrink-0 rounded-xl bg-emerald-700 px-3 text-white hover:bg-emerald-800 sm:px-4"
              >
                {searchMutation.isPending ? <Loader2 className="animate-spin" /> : <Search />}
                <span className="hidden sm:inline">{searchMutation.isPending ? "Searching…" : "AI search"}</span>
                <span className="sr-only sm:hidden">{searchMutation.isPending ? "Searching" : "AI search"}</span>
              </Button>
              {searchMutation.isSuccess && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    searchMutation.reset();
                    nearbySearchMutation.reset();
                  }}
                  className="h-10 rounded-xl border-stone-300 bg-white px-3 text-stone-800 hover:bg-stone-100 hover:text-stone-950 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:hover:text-white"
                >
                  <span className="hidden sm:inline">Clear</span>
                  <X className="size-4 sm:hidden" />
                </Button>
              )}
            </form>
            <Button
              type="button"
              variant="outline"
              disabled={nearbySearchMutation.isPending || searchMutation.isPending}
              onClick={() => {
                searchMutation.reset();
                nearbySearchMutation.mutate();
              }}
              className="h-10 w-full shrink-0 rounded-xl border-emerald-200 bg-white px-3 text-emerald-800 hover:bg-emerald-50 sm:w-auto sm:px-4"
            >
              {nearbySearchMutation.isPending ? <Loader2 className="animate-spin" /> : <LocateFixed />}
              <span>{nearbySearchMutation.isPending ? "Finding nearby…" : "Rooms Near Me"}</span>
            </Button>
          </div>
          <p className="mt-1 hidden text-xs text-stone-600 sm:block">Search naturally by room type, rent, or nearby landmark.</p>
          {searchText.trim().length > 0 && searchText.trim().length < 5 && (
            <p className="mt-2 text-xs text-amber-800">Enter at least 5 characters to search.</p>
          )}
          {searchMutation.isError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {getSearchErrorMessage(searchMutation.error)}
            </p>
          )}
          {searchMutation.isSuccess && (
            <p role="status" className="mt-2 text-xs text-emerald-800">
              {searchMutation.data.length} {searchMutation.data.length === 1 ? "place" : "places"} found for “{searchMutation.variables}”.
            </p>
          )}
          {nearbySearchMutation.isError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {getSearchErrorMessage(nearbySearchMutation.error)}
            </p>
          )}
          {nearbySearchMutation.isSuccess && (
            <p role="status" className="mt-2 text-xs text-emerald-800">
              {nearbySearchMutation.data.length} {nearbySearchMutation.data.length === 1 ? "place" : "places"} found within 2 km of you.
              <button
                type="button"
                onClick={() => nearbySearchMutation.reset()}
                className="ml-2 font-semibold underline"
              >
                Clear
              </button>
            </p>
          )}
        </Card>

        {createdPropertyId && (
          <Card className="mb-6 flex flex-col gap-3 rounded-2xl border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-950">Your place listing was created successfully!</p>
              <p className="mt-1 text-sm text-emerald-800">It is now available in {city}. You can open it to check the details.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                onClick={() => setSelectedProperty(createdPropertyId)}
                className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
              >
                View listing
              </Button>
              <Button type="button" variant="outline" aria-label="Dismiss listing created message" onClick={clearCreatedListing} className="rounded-xl">
                <X />
              </Button>
            </div>
          </Card>
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            {nearbySearchMutation.isSuccess
              ? `${sortedDisplayedProperties.length} places within 2 km`
              : searchMutation.isSuccess
              ? `${sortedDisplayedProperties.length} search results`
              : `${propertiesQuery.data?.total ?? 0} places`}
            {propertiesQuery.isFetching && propertiesQuery.isPlaceholderData ? (
              <span className="ml-2 text-xs text-emerald-700">Updating…</span>
            ) : null}
          </p>
          {nearbySearchMutation.isSuccess ? (
            <span className="text-sm font-medium text-stone-600">Nearest first</span>
          ) : <Select value={sort} onValueChange={(value) => {
            if (value === "newest" || value === "oldest" || value === "price_asc") {
              setSort(value);
              setPage(0);
            }
          }}>
            <SelectTrigger aria-label="Sort listings" className="h-9 w-44 rounded-xl border-stone-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
            </SelectContent>
          </Select>}
        </div>

        {propertiesQuery.isLoading && !searchMutation.isSuccess && !nearbySearchMutation.isSuccess ? (
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" role="status" aria-label="Loading nearby places">
            <div className="min-w-0 space-y-4">
              {Array.from({ length: 3 }, (_, index) => (
                <Card key={index} className="flex min-h-32 gap-3 overflow-hidden rounded-3xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900 sm:min-h-40 sm:gap-5 sm:p-4">
                  <div className="h-28 w-28 shrink-0 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800 sm:h-36 sm:w-40" />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-emerald-100 dark:bg-emerald-950" />
                    <div className="h-5 w-4/5 animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
                    <div className="h-4 w-2/3 animate-pulse rounded-md bg-stone-100 dark:bg-stone-800" />
                    <div className="h-7 w-28 animate-pulse rounded-lg bg-emerald-100 dark:bg-emerald-950" />
                  </div>
                </Card>
              ))}
            </div>
            <div className="hidden lg:sticky lg:top-24 lg:block">
              <div className="h-96 animate-pulse rounded-3xl border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-900" />
            </div>
          </div>
        ) : propertiesQuery.isError && !searchMutation.isSuccess && !nearbySearchMutation.isSuccess ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            We couldn&apos;t load local listings. Check your connection, then try again.
            <button onClick={() => void propertiesQuery.refetch()} className="ml-2 font-semibold underline">Retry</button>
          </div>
        ) : (
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section aria-label="Available places" className="min-w-0 space-y-4">
              {sortedDisplayedProperties.map((property) => (
                <Card key={property.id} className="group min-w-0 overflow-hidden rounded-3xl border border-stone-200 bg-white p-0 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
                  <button
                    type="button"
                    onClick={() => openProperty(property)}
                    onPointerEnter={() => warmPropertyDetails(property)}
                    onFocus={() => warmPropertyDetails(property)}
                    className="flex min-h-32 w-full min-w-0 gap-3 p-3 text-left sm:min-h-40 sm:gap-5 sm:p-4"
                  >
                  {property.image_urls?.[0] ? (
                    <img src={property.image_urls[0]} alt="" loading="lazy" className="h-28 w-28 shrink-0 rounded-2xl bg-stone-100 object-contain sm:h-36 sm:w-40" />
                  ) : (
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-100 via-lime-50 to-amber-100 text-emerald-800 sm:h-36 sm:w-40">
                      <BedDouble size={30} />
                    </div>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col justify-center py-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">{property.type}</span>
                      {property.is_verified && <ShieldCheck size={17} className="text-emerald-700" aria-label="Verified" />}
                    </span>
                    <span className="mt-2 truncate text-base font-semibold sm:text-lg">{property.title}</span>
                    <span className="mt-1 flex items-center gap-1 truncate text-sm text-stone-500"><MapPin size={14} className="shrink-0" />{property.area || property.city || "Cooch Behar"}</span>
                    <span className="mt-1 truncate text-xs text-stone-500">
                      {property.owner_name ? `By ${property.owner_name}` : "Local owner"}
                      {property.created_at ? ` · ${formatPostedAgo(property.created_at)}` : ""}
                    </span>
                    <span className="mt-2 inline-flex items-baseline gap-1 self-start rounded-lg bg-emerald-50 px-2 py-1 text-lg font-bold text-emerald-800">₹{Number(property.price).toLocaleString("en-IN")}<span className="text-xs font-normal text-emerald-700">/ month</span></span>
                  </span>
                  </button>
                </Card>
              ))}

              {displayedProperties.length === 0 && (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
                  <BedDouble className="mx-auto text-stone-400" size={32} />
                  <h2 className="mt-3 font-semibold">
                    {nearbySearchMutation.isSuccess
                      ? "No places found nearby"
                      : searchMutation.isSuccess
                        ? "No matching places found"
                        : "No places listed here yet"}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {nearbySearchMutation.isSuccess
                      ? "There are no active listings within 2 km of your current location."
                      : searchMutation.isSuccess
                        ? "Try a broader search, another rent range, or a different landmark."
                        : `Be the first to share a place in ${city}.`}
                  </p>
                </div>
              )}
              {!searchMutation.isSuccess && !nearbySearchMutation.isSuccess && totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                  <Button type="button" variant="outline" disabled={page === 0 || propertiesQuery.isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))} className="h-10 rounded-xl">
                    <ArrowLeft /> <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-sm font-medium text-stone-600">Page {page + 1} of {totalPages}</span>
                  <Button type="button" variant="outline" disabled={page + 1 >= totalPages || propertiesQuery.isFetching} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                    <span className="hidden sm:inline">Next</span> <ArrowRight />
                  </Button>
                </div>
              )}
            </section>

            <div className="hidden lg:sticky lg:top-24 lg:block">
              <PropertyMap properties={mapProperties} onPropertySelect={(id) => setSelectedProperty(String(id))} />
              <p className="mt-2 text-center text-xs text-stone-500">Select a marker to preview a place. Map positions are approximate.</p>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePropertyDetails();
          }}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-label="Place details"
            className="relative max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-white p-0 shadow-2xl sm:rounded-[2rem]"
          >
            <button
              type="button"
              onClick={closePropertyDetails}
              aria-label="Close details"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-stone-700 shadow hover:bg-white"
            >
              <X size={20} />
            </button>
            {detailQuery.isLoading ? (
              <div aria-label="Loading listing details" className="animate-pulse">
                <div className="h-48 bg-stone-200 dark:bg-stone-800 sm:h-60" />
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="h-7 w-3/4 rounded-md bg-stone-200 dark:bg-stone-800" />
                  <div className="h-5 w-1/3 rounded-md bg-stone-100 dark:bg-stone-800" />
                  <div className="h-10 w-1/2 rounded-xl bg-emerald-100 dark:bg-emerald-950" />
                  <div className="h-24 rounded-2xl bg-stone-100 dark:bg-stone-800" />
                </div>
              </div>
            ) : detailQuery.isError ? (
              <div role="alert" className="p-8 text-center">
                <p className="font-semibold">We couldn&apos;t open this listing.</p>
                <button onClick={() => void detailQuery.refetch()} className="mt-3 text-emerald-800 underline">Try again</button>
              </div>
            ) : detail ? (
              <>
                <div
                  className="relative h-48 shrink-0 touch-pan-y overflow-hidden bg-stone-100 sm:h-60"
                  style={{ touchAction: activePhotoZoom > 1 ? "none" : "pan-y" }}
                  onTouchStart={(event) => {
                    if (activePhotoZoom > 1) return;
                    photoTouchStartX.current = event.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(event) => {
                    const startX = photoTouchStartX.current;
                    const endX = event.changedTouches[0]?.clientX;
                    photoTouchStartX.current = null;
                    if (activePhotoZoom > 1 || startX === null || endX === undefined || detailImages.length < 2) return;
                    const distance = endX - startX;
                    if (Math.abs(distance) < 40) return;
                    setPhotoSelection({
                      propertyId: selectedId,
                      index: (activePhotoIndex + (distance < 0 ? 1 : -1) + detailImages.length) % detailImages.length,
                    });
                  }}
                  onPointerDown={(event) => {
                    if (activePhotoZoom <= 1 || (event.target instanceof Element && event.target.closest("button"))) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    photoDragStart.current = {
                      pointerX: event.clientX,
                      pointerY: event.clientY,
                      panX: activePhotoPan.x,
                      panY: activePhotoPan.y,
                    };
                  }}
                  onPointerMove={(event) => {
                    const dragStart = photoDragStart.current;
                    if (!dragStart) return;
                    setPhotoPan({
                      propertyId: selectedId,
                      index: activeImageIndex,
                      x: Math.max(-400, Math.min(400, dragStart.panX + event.clientX - dragStart.pointerX)),
                      y: Math.max(-300, Math.min(300, dragStart.panY + event.clientY - dragStart.pointerY)),
                    });
                  }}
                  onPointerUp={() => {
                    photoDragStart.current = null;
                  }}
                  onPointerCancel={() => {
                    photoDragStart.current = null;
                  }}
                >
                  {detailImages[activeImageIndex] ? (
                    <img
                      src={detailImages[activeImageIndex]}
                      alt={`${detail.title}, photo ${activeImageIndex + 1}`}
                      draggable={false}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open photo ${activeImageIndex + 1} in full-screen viewer`}
                      onClick={() => setPhotoViewerIndex(activeImageIndex)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setPhotoViewerIndex(activeImageIndex);
                        }
                      }}
                      className={`h-full w-full cursor-zoom-in object-contain transition-transform duration-200 ${activePhotoZoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
                      style={{
                        transform: `translate(${activePhotoPan.x}px, ${activePhotoPan.y}px) scale(${activePhotoZoom})`,
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-emerald-800"><BedDouble size={42} /></div>
                  )}
                  {detailImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous photo"
                        onClick={() => setPhotoSelection({
                          propertyId: selectedId,
                          index: (activePhotoIndex - 1 + detailImages.length) % detailImages.length,
                        })}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-stone-800 shadow hover:bg-white"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        aria-label="Next photo"
                        onClick={() => setPhotoSelection({
                          propertyId: selectedId,
                          index: (activePhotoIndex + 1) % detailImages.length,
                        })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-stone-800 shadow hover:bg-white"
                      >
                        <ChevronRight size={20} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-stone-950/45 px-2.5 py-1.5">
                        {detailImages.map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            aria-label={`Show photo ${index + 1}`}
                            aria-current={index === activeImageIndex}
                            onClick={() => setPhotoSelection({ propertyId: selectedId, index })}
                            className={`h-1.5 w-1.5 rounded-full ${index === activeImageIndex ? "bg-white" : "bg-white/50"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {detailImages[activeImageIndex] && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-stone-950/60 p-1 text-white shadow">
                      <button
                        type="button"
                        aria-label="Zoom out"
                        title="Zoom out"
                        disabled={activePhotoZoom <= 1}
                        onClick={() => {
                          const scale = Math.max(1, activePhotoZoom - 0.5);
                          setPhotoZoom({ propertyId: selectedId, index: activeImageIndex, scale });
                          if (scale === 1) {
                            setPhotoPan({ propertyId: selectedId, index: activeImageIndex, x: 0, y: 0 });
                          }
                        }}
                        className="rounded-full p-2 transition hover:bg-white/20 disabled:opacity-40"
                      >
                        <ZoomOut size={17} />
                      </button>
                      <span className="min-w-10 text-center text-xs tabular-nums">{Math.round(activePhotoZoom * 100)}%</span>
                      <button
                        type="button"
                        aria-label="Zoom in"
                        title="Zoom in"
                        disabled={activePhotoZoom >= 3}
                        onClick={() => setPhotoZoom({
                          propertyId: selectedId,
                          index: activeImageIndex,
                          scale: Math.min(3, activePhotoZoom + 0.5),
                        })}
                        className="rounded-full p-2 transition hover:bg-white/20 disabled:opacity-40"
                      >
                        <ZoomIn size={17} />
                      </button>
                    </div>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-full bg-stone-950/55 px-2.5 py-1 text-xs text-white">
                    {detailImages.length ? `${activeImageIndex + 1} / ${detailImages.length}` : "No photos"}
                  </span>
                </div>
                <div className="max-h-[calc(88dvh-12rem)] overflow-y-auto p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">{detail.type}</span>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{detail.title}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!signedIn) {
                          router.push(`/login?next=${encodeURIComponent(`/explore?property=${selectedId}`)}`);
                          return;
                        }
                        saveMutation.mutate();
                      }}
                      disabled={saveMutation.isPending || savedQuery.isLoading}
                      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                        savedQuery.data?.saved ? "border-rose-200 bg-rose-50 text-rose-700" : "border-stone-200 text-stone-700 hover:border-rose-200 hover:text-rose-700"
                      }`}
                    >
                      {saveMutation.isPending || savedQuery.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} className={savedQuery.data?.saved ? "fill-current" : ""} />}
                      {savedQuery.data?.saved ? "Saved" : "Save"}
                    </button>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-emerald-800">₹{Number(detail.price).toLocaleString("en-IN")}<span className="text-sm font-normal text-stone-500"> / month</span></p>
                  <p className="mt-1 text-sm text-stone-500">
                    Listed by <span className="font-medium text-stone-700">{detail.owner_name || "Local owner"}</span>
                    {detail.created_at ? ` · Posted ${formatPostedAgo(detail.created_at)}` : ""}
                  </p>
                  {detailHasCoordinates && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm font-semibold text-stone-800">Location on map</p>
                      <PropertyMap
                        className="h-32 sm:h-36"
                        properties={[{
                          id: detail.id,
                          title: detail.title,
                          area: detail.area || detail.city || "",
                          price: Number(detail.price),
                          type: detail.type,
                          latitude: detail.latitude!,
                          longitude: detail.longitude!,
                          image_urls: detail.image_urls,
                        }]}
                        center={[detail.latitude!, detail.longitude!]}
                      />
                    </div>
                  )}
                  <div className="mt-5 space-y-3 rounded-2xl bg-stone-50 p-4 text-sm">
                    <p className="flex items-start gap-2 text-stone-700"><MapPin size={17} className="mt-0.5 shrink-0 text-emerald-700" /><span><strong className="block text-stone-900">Address</strong>{detail.address || detail.area || detail.city || "Address not provided"}</span></p>
                    {detail.description && <p className="border-t border-stone-200 pt-3 leading-6 text-stone-600">{detail.description}</p>}
                  </div>
                  {saveMutation.isError && (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                      Couldn&apos;t update your saved places. Please try again.
                    </p>
                  )}
                  <div className="mt-5 border-t border-stone-200 pt-4">
                    {reportMutation.isSuccess && reportMutation.variables?.propertyId === selectedId ? (
                      <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                        Thanks for letting us know. Your report has been sent for review.
                      </p>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (!signedIn) {
                              router.push(`/login?next=${encodeURIComponent(`/explore?property=${selectedId}`)}`);
                              return;
                            }
                            reportMutation.reset();
                            setReportOpen((open) => !open);
                          }}
                          className="h-10 rounded-full border-stone-300 text-stone-700"
                        >
                          <Flag size={16} /> Report listing
                        </Button>
                        {reportOpen && (
                          <form
                            className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (!selectedId) return;
                              reportMutation.mutate({
                                propertyId: selectedId,
                                reason: reportReason,
                                details: reportDetails,
                              });
                            }}
                          >
                            <label htmlFor="report-reason" className="block text-sm font-semibold text-stone-800">
                              What is the issue?
                            </label>
                            <select
                              id="report-reason"
                              value={reportReason}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "suspicious" || value === "inaccurate" || value === "inappropriate" || value === "other") {
                                  setReportReason(value);
                                }
                              }}
                              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                            >
                              <option value="suspicious">Suspicious or possibly fraudulent</option>
                              <option value="inaccurate">Inaccurate or unavailable</option>
                              <option value="inappropriate">Inappropriate content</option>
                              <option value="other">Something else</option>
                            </select>
                            <label htmlFor="report-details" className="block text-sm font-semibold text-stone-800">
                              Add details <span className="font-normal text-stone-500">(optional)</span>
                            </label>
                            <Textarea
                              id="report-details"
                              value={reportDetails}
                              onChange={(event) => setReportDetails(event.target.value)}
                              maxLength={1000}
                              rows={3}
                              placeholder="Tell us what seems wrong. Please don't include passwords or payment details."
                              className="bg-white"
                            />
                            {reportMutation.isError && (
                              <p role="alert" className="text-sm text-red-700">
                                {getSearchErrorMessage(reportMutation.error)}
                              </p>
                            )}
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={reportMutation.isPending}
                                onClick={() => setReportOpen(false)}
                                className="rounded-full"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={reportMutation.isPending}
                                className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                              >
                                {reportMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                                Send report
                              </Button>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                  {revealedContact?.propertyId === selectedId && revealedContact.phone ? (
                    <a href={`tel:${revealedContact.phone}`} className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 font-semibold text-white transition hover:bg-emerald-800">
                      <Phone size={17} /> Call owner · {revealedContact.phone}
                    </a>
                  ) : revealedContact?.propertyId === selectedId ? (
                    <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">The owner has not shared a contact number for this listing.</p>
                  ) : signedIn ? (
                    <Button
                      type="button"
                      disabled={contactRevealMutation.isPending}
                      onClick={() => contactRevealMutation.mutate(selectedId)}
                      className="mt-5 h-12 w-full rounded-full bg-emerald-700 font-semibold text-white transition hover:bg-emerald-800"
                    >
                      {contactRevealMutation.isPending
                        ? <Loader2 className="animate-spin" size={17} />
                        : <Phone size={17} />}
                      {contactRevealMutation.isPending ? "Getting contact…" : "Show owner contact"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => router.push(`/login?next=${encodeURIComponent(`/explore?property=${selectedId}`)}`)}
                      className="mt-5 h-12 w-full rounded-full bg-emerald-700 font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Sign in to request contact
                    </Button>
                  )}
                  {contactRevealMutation.isError && (
                    <p role="alert" className="mt-2 text-sm text-red-700">
                      {getSearchErrorMessage(contactRevealMutation.error)}
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </Card>
        </div>
      )}
      {photoViewerIndex !== null && detailImages[photoViewerIndex] && detail && (
        <PropertyPhotoViewer
          images={detailImages}
          title={detail.title}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
    </main>
  );
}
