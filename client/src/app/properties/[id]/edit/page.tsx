"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });
const COOCH_BEHAR_BOUNDS: [[number, number], [number, number]] = [[25.9, 88.7], [26.75, 89.85]];

const editSchema = z.object({
  title: z.string().min(5).max(100),
  area: z.string().min(2).max(100),
  address: z.string().min(5).max(250),
  city: z.string().min(2).max(100),
  description: z.string().min(10),
  type: z.enum(["room", "pg", "flat"]),
  price: z.coerce.number().positive(),
  contact_phone: z.string().trim().min(7).max(30).regex(/^[+0-9()\-\s]+$/),
});

type EditFormInput = z.input<typeof editSchema>;
type EditForm = z.output<typeof editSchema>;
type PropertyDetail = EditForm & {
  id: string;
  latitude: number | null;
  longitude: number | null;
  image_urls?: string[];
};
type City = {
  id: string;
  name: string;
  state?: string | null;
  center_latitude?: number | string | null;
  center_longitude?: number | string | null;
};

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === "string" ? detail : error.message;
  }
  return error instanceof Error ? error.message : "Could not update this listing.";
}

export default function EditPropertyPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] flex-1 items-center justify-center"><Loader2 className="animate-spin text-emerald-700" /></main>}>
      <EditPropertyForm />
    </Suspense>
  );
}

function EditPropertyForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const propertyQuery = useQuery<PropertyDetail>({
    queryKey: ["property", id],
    queryFn: async () => (await api.get<PropertyDetail>(`/properties/${id}`)).data,
    enabled: Boolean(id),
  });
  const citiesQuery = useQuery<City[]>({
    queryKey: ["cities"],
    queryFn: async () => (await api.get<City[]>("/properties/cities")).data,
  });
  const form = useForm<EditFormInput, unknown, EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: "",
      area: "",
      address: "",
      city: "Cooch Behar",
      description: "",
      type: "room",
      price: 1,
      contact_phone: "",
    },
  });
  const selectedCityName = useWatch({ control: form.control, name: "city" });
  const selectedType = useWatch({ control: form.control, name: "type" });
  const selectedCity = citiesQuery.data?.find((city) => city.name === selectedCityName);
  const mapCenter: [number, number] = [
    Number(selectedCity?.center_latitude ?? 26.323),
    Number(selectedCity?.center_longitude ?? 89.451),
  ];
  const bounds = selectedCityName === "Cooch Behar" ? COOCH_BEHAR_BOUNDS : undefined;

  useEffect(() => {
    const property = propertyQuery.data;
    if (!property) return;
    form.reset({
      title: property.title,
      area: property.area || "",
      address: property.address || "",
      city: property.city || "Cooch Behar",
      description: property.description || "",
      type: property.type,
      price: Number(property.price),
      contact_phone: property.contact_phone || "",
    });
  }, [propertyQuery.data, form]);

  const propertyCoordinates: [number, number] | null =
    typeof propertyQuery.data?.latitude === "number" && typeof propertyQuery.data.longitude === "number"
      ? [propertyQuery.data.latitude, propertyQuery.data.longitude]
      : null;
  const selectedLocation = coordinates ?? propertyCoordinates ?? mapCenter;

  const updateMutation = useMutation({
    mutationFn: async (values: EditForm) => api.patch(`/properties/${id}`, {
      ...values,
      latitude: selectedLocation[0],
      longitude: selectedLocation[1],
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["properties"] }),
        queryClient.invalidateQueries({ queryKey: ["property", id] }),
      ]);
      router.push("/account#listings");
    },
    onError: (error: unknown) => setErrorMessage(getErrorMessage(error)),
  });

  if (propertyQuery.isLoading) {
    return <main className="flex min-h-[60vh] flex-1 items-center justify-center"><Loader2 className="animate-spin text-emerald-700" /></main>;
  }
  if (propertyQuery.isError || !propertyQuery.data) {
    return (
      <main className="flex min-h-[60vh] flex-1 items-center justify-center px-4">
        <div role="alert" className="rounded-2xl bg-red-50 p-5 text-red-800">
          Couldn&apos;t load this listing. <button onClick={() => void propertyQuery.refetch()} className="font-semibold underline">Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex-1 bg-[#faf9f6] px-4 py-8 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Button type="button" variant="ghost" onClick={() => router.push("/account#listings")} className="mb-4 rounded-full">
          <ArrowLeft size={17} /> Back to account
        </Button>
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Edit your listing</CardTitle>
            <p className="text-sm text-stone-500">Update details, contact information, and map location.</p>
          </CardHeader>
          <CardContent>
            {errorMessage && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
            <form onSubmit={form.handleSubmit((values) => {
              setErrorMessage("");
              updateMutation.mutate(values);
            })} className="space-y-4">
              <div>
                <Label htmlFor="title">Listing title</Label>
                <Input id="title" {...form.register("title")} className="mt-1 h-11" />
                {form.formState.errors.title && <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="area">Area / locality</Label>
                  <Input id="area" {...form.register("area")} className="mt-1 h-11" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Select value={selectedCityName} onValueChange={(value) => {
                    if (!value) return;
                    form.setValue("city", value, { shouldValidate: true });
                    const city = citiesQuery.data?.find((item) => item.name === value);
                    setCoordinates([
                      Number(city?.center_latitude ?? 26.323),
                      Number(city?.center_longitude ?? 89.451),
                    ]);
                  }}>
                    <SelectTrigger id="city" className="mt-1 h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(citiesQuery.data ?? []).map((city) => (
                        <SelectItem key={city.id} value={city.name}>{city.name}{city.state ? `, ${city.state}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="price">Monthly rent (₹)</Label>
                  <Input id="price" type="number" {...form.register("price")} className="mt-1 h-11" />
                </div>
                <div>
                  <Label htmlFor="type">Property type</Label>
                  <Select value={selectedType} onValueChange={(value) => {
                    if (value === "room" || value === "pg" || value === "flat") {
                      form.setValue("type", value, { shouldValidate: true });
                    }
                  }}>
                    <SelectTrigger id="type" className="mt-1 h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Room</SelectItem>
                      <SelectItem value="pg">PG</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="address">Full address</Label>
                <Input id="address" {...form.register("address")} className="mt-1 h-11" />
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact number</Label>
                <Input id="contact_phone" type="tel" inputMode="tel" {...form.register("contact_phone")} className="mt-1 h-11" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} {...form.register("description")} className="mt-1" />
              </div>
              <div className="space-y-2">
                <div>
                  <Label>Map location</Label>
                  <p className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin size={14} />Tap the map to move the location pin.</p>
                </div>
                <PropertyMap
                  key={selectedCityName}
                  properties={[]}
                  selectable
                  center={mapCenter}
                  bounds={bounds}
                  selectedLocation={selectedLocation}
                  onLocationSelect={setCoordinates}
                />
              </div>
              {propertyQuery.data.image_urls?.length ? (
                <p className="text-xs text-stone-500">Existing photos are kept when you save edits.</p>
              ) : null}
              <Button type="submit" disabled={updateMutation.isPending} className="h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
                {updateMutation.isPending && <Loader2 className="animate-spin" size={16} />}
                Save listing changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
