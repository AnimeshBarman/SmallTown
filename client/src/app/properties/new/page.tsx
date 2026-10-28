"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { markListingCreated } from "@/lib/listing-created";
import { processAndCompressImage } from "@/lib/compressor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, X, MapPin } from "lucide-react";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

// Schema matching FastAPI Pydantic requirements
const propertySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  area: z.string().min(2, "Area is required"),
  address: z.string().min(5, "Enter the complete address"),
  contact_phone: z.string()
    .trim()
    .min(7, "Enter a contact phone number")
    .max(30)
    .regex(/^[+0-9()\-\s]+$/, "Use only digits, spaces, +, parentheses, or hyphens"),
  city: z.string().min(2, "Choose a city"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  type: z.enum(["room", "pg", "flat"]),
  price: z.coerce.number().min(1, "Price must be greater than 0"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

type PropertyFormInput = z.input<typeof propertySchema>;
type PropertyFormValues = z.output<typeof propertySchema>;
const COOCH_BEHAR_BOUNDS: [[number, number], [number, number]] = [[25.9, 88.7], [26.75, 89.85]];

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item: unknown) => {
        if (typeof item === "string") return [item];
        if (!item || typeof item !== "object") return [];

        const validationError = item as {
          loc?: unknown;
          msg?: unknown;
        };
        if (typeof validationError.msg !== "string") return [];

        const location = Array.isArray(validationError.loc)
          ? validationError.loc.filter(
              (part): part is string | number =>
                typeof part === "string" || typeof part === "number"
            ).join(".")
          : "";

        return [location ? `${location}: ${validationError.msg}` : validationError.msg];
      });

      if (messages.length) return messages.join("; ");
    }

    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export default function CreatePropertyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number]>([26.323, 89.451]);
  const [selectedCityName, setSelectedCityName] = useState("Cooch Behar");
  
  // File & Upload States
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  
  // Status States
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const citiesQuery = useQuery<{
    id: string;
    name: string;
    state?: string | null;
    center_latitude?: number | string | null;
    center_longitude?: number | string | null;
  }[]>({
    queryKey: ["cities"],
    queryFn: async () => (await api.get("/properties/cities")).data,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    setValue,
  } = useForm<PropertyFormInput, unknown, PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      price: 5000,
      city: "Cooch Behar",
      type: "room",
      latitude: 26.323,
      longitude: 89.451,
    },
  });
  const selectedCity = citiesQuery.data?.find((city) => city.name === selectedCityName);
  const mapCenter: [number, number] = [
    Number(selectedCity?.center_latitude ?? 26.323),
    Number(selectedCity?.center_longitude ?? 89.451),
  ];
  const coochBeharBounds: [[number, number], [number, number]] | undefined =
    selectedCityName === "Cooch Behar" ? COOCH_BEHAR_BOUNDS : undefined;

  // Handle local file selection with 9MB guardrail
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    if (!e.target.files) return;

    const filesArray = Array.from(e.target.files).slice(0, 3); // Max 3 images
    const MAX_INPUT_SIZE = 9 * 1024 * 1024; // 9MB limit

    // Guardrail: Check raw file sizes before doing anything
    for (const file of filesArray) {
      if (file.size > MAX_INPUT_SIZE) {
        setErrorMessage(`File "${file.name}" exceeds the 9MB limit. Please select a smaller photo.`);
        return;
      }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
    }

    setSelectedFiles(filesArray);

    // Clean up previous blob previews
    previewUrls.forEach((url) => URL.revokeObjectURL(url));

    // Generate local Object URLs for instant preview
    const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
    setPreviewUrls(newPreviews);
  };

  // Remove a photo from preview list
  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setPreviewUrls(updatedPreviews);
  };

  // Compress and batch upload to FastAPI
  const handleCompressAndUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setErrorMessage("");

    try {
      // Step A: Compress all selected images concurrently using HTML5 Canvas
      const compressionPromises = selectedFiles.map((file) => processAndCompressImage(file));
      const compressedFiles = await Promise.all(compressionPromises);

      // Step B: Upload the batch using the backend's repeated "files" field.
      const formData = new FormData();
      compressedFiles.forEach((file) => formData.append("files", file));
      const response = await api.post<{ urls: string[] }>(
        "/properties/upload-images",
        formData
      );

      setUploadedImageUrls(response.data.urls);
      setStep(3); // Advance to final review step
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, "Image compression or upload failed. Please try again."));
    } finally {
      setIsUploading(false);
    }
  };

  // Step C: Send clean JSON payload to create-property endpoint
  const onSubmit = async (data: PropertyFormValues) => {
    setIsSubmitting(true);
    setErrorMessage("");

    const payload = {
      ...data,
      image_urls: uploadedImageUrls, // Contains array of up to 3 Supabase URLs
    };

    try {
      const { data: createdProperty } = await api.post<{ id: string }>(
        "/properties/create-property",
        payload
      );
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      markListingCreated(createdProperty.id);
      router.push("/explore");
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, "Failed to create property listing."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex-1 bg-[#faf9f6] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header Stepper */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-stone-900 tracking-tight">List your place</h1>
          <p className="text-stone-600 mt-1">Share the details that help someone feel at home.</p>

          <div className="flex justify-center items-center gap-3 mt-6">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 1 ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-700'}`}>
              1. Property Info
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 2 ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-700'}`}>
              2. Photos (Max 3)
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 3 ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-700'}`}>
              3. Review & Submit
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        <Card className="shadow-lg border-gray-200">
          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <form onSubmit={handleSubmit(async () => {
              const isValid = await trigger();
              if (isValid) setStep(2);
            })}>
              <CardHeader>
                <CardTitle>Property Details & Location</CardTitle>
                <CardDescription>Share the essentials, then pin the place on the map.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="e.g. Spacious PG Near College Gate 2" {...register("title")} className="mt-1" />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="area">Area / Locality</Label>
                    <Input id="area" placeholder="e.g. City Center" {...register("area")} className="mt-1" />
                    {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Select
                      value={selectedCityName}
                      onValueChange={(cityName) => {
                        if (!cityName) return;
                        setSelectedCityName(cityName);
                        setValue("city", cityName, { shouldValidate: true });
                        const city = citiesQuery.data?.find((option) => option.name === cityName);
                        const coordinates: [number, number] = [
                          Number(city?.center_latitude ?? 26.323),
                          Number(city?.center_longitude ?? 89.451),
                        ];
                        setSelectedCoordinates(coordinates);
                        setValue("latitude", coordinates[0], { shouldValidate: true });
                        setValue("longitude", coordinates[1], { shouldValidate: true });
                      }}
                    >
                      <SelectTrigger id="city" className="mt-1 h-11 w-full">
                        <SelectValue placeholder="Choose a city" />
                      </SelectTrigger>
                      <SelectContent>
                        {(citiesQuery.data ?? [{ id: "cooch-behar", name: "Cooch Behar", state: "West Bengal" }]).map((city) => (
                          <SelectItem key={city.id} value={city.name}>{city.name}{city.state ? `, ${city.state}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {citiesQuery.isError && <p className="mt-1 text-xs text-red-500">Couldn&apos;t load the city list. Please refresh and try again.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="price">Monthly Rent (₹)</Label>
                    <Input id="price" type="number" {...register("price")} className="mt-1" />
                    {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="type">Property Type</Label>
                    <Select
                      defaultValue="room"
                      onValueChange={(value) => {
                        if (value === "room" || value === "pg" || value === "flat") {
                          setValue("type", value, { shouldValidate: true });
                        }
                      }}
                    >
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
                  <Input id="address" placeholder="House, street, landmark" {...register("address")} className="mt-1" />
                  {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>}
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact number for this listing</Label>
                  <Input id="contact_phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register("contact_phone")} className="mt-1 h-11" />
                  <p className="mt-1 text-xs text-stone-500">Shown to people who open your listing. This is separate from your profile.</p>
                  {errors.contact_phone && <p className="mt-1 text-xs text-red-500">{errors.contact_phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <div>
                    <Label>Pin the location</Label>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" />Tap to place or move the pin in the approximate Cooch Behar district area.</p>
                  </div>
                  <PropertyMap
                    properties={[]}
                    selectable
                    center={mapCenter}
                    bounds={coochBeharBounds}
                    selectedLocation={selectedCoordinates}
                    onLocationSelect={(location) => {
                      setSelectedCoordinates(location);
                      setValue("latitude", location[0], { shouldValidate: true });
                      setValue("longitude", location[1], { shouldValidate: true });
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" rows={4} placeholder="Describe room amenities, Wi-Fi, food options..." {...register("description")} className="mt-1" />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800">
                    Next: Upload Photos <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </form>
          )}

          {/* STEP 2: Client Compression & Multi-Image Upload */}
          {step === 2 && (
            <CardContent className="space-y-6 pt-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Upload Room Photos (Up to 3)</CardTitle>
                <CardDescription>
                  Raw files up to <strong>9MB</strong> are accepted. They will automatically be compressed in your browser to &lt;2MB WebP format before being sent to the server.
                </CardDescription>
              </CardHeader>

              <div className="border-2 border-dashed border-stone-300 rounded-2xl p-6 text-center bg-stone-50 hover:bg-stone-100 transition">
                <Upload className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
                <input
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileSelect}
                  className="mx-auto block text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              {/* Local Previews */}
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden h-28 border border-gray-200 group">
                      <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleCompressAndUpload}
                  disabled={selectedFiles.length === 0 || isUploading}
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  {isUploading ? "Compressing & Uploading..." : "Compress & Continue"}
                </Button>
              </div>
            </CardContent>
          )}

          {/* STEP 3: Review and Final Submission */}
          {step === 3 && (
            <CardContent className="space-y-6 pt-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Review Listing</CardTitle>
                <CardDescription>
                  Your images are compressed and stored in Supabase Storage. Click publish to list your property.
                </CardDescription>
              </CardHeader>

              {/* Uploaded Remote Images Preview */}
              <div className="grid grid-cols-3 gap-4">
                {uploadedImageUrls.map((url, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 h-28 shadow-sm">
                    <img src={url} alt={`Uploaded ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-sm space-y-1 text-emerald-900">
                <p><span className="font-semibold">Images Uploaded:</span> {uploadedImageUrls.length} file(s)</p>
                <p><span className="font-semibold">Storage Provider:</span> Supabase Cloud Bucket</p>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Publish Property Listing 🚀
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </main>
  );
}