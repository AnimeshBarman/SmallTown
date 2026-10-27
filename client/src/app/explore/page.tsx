"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Building } from "lucide-react";

// Dynamically import the map to avoid SSR window errors
const PropertyMap = dynamic(() => import("@/components/PropertyMap"), {
  ssr: false,
  loading: () => (
    <div className="h-150 w-full bg-gray-100 flex items-center justify-center rounded-2xl">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  ),
});

type PropertySummary = {
  id: number | string;
  title: string;
  area: string;
  type: string;
  price: number;
  image_urls?: string[];
  latitude?: number | null;
  longitude?: number | null;
};

export default function ExplorePage() {
  const { data: properties = [], isLoading, error } = useQuery<PropertySummary[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const response = await api.get<PropertySummary[]>("/properties");
      return response.data;
    },
  });
  const mapProperties = properties.filter(
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

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Find Your Sanctuary</h1>
          <p className="text-gray-600 mt-1">Explore verified student rooms, flats, and PGs near you.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            Failed to load properties from the backend. Make sure your FastAPI server is running!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Property List Cards */}
            <div className="lg:col-span-5 space-y-4 max-h-150 overflow-y-auto pr-2">
              {properties.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                  <Building className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No listings found yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Be the first to list a property!</p>
                </div>
              ) : (
                properties.map((prop) => (
                  <div key={prop.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition">
                    <div className="flex gap-4">
                      {prop.image_urls?.[0] && (
                        <img 
                          src={prop.image_urls[0]} 
                          alt={prop.title} 
                          className="w-24 h-24 object-cover rounded-xl"
                        />
                      )}
                      <div>
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-md uppercase tracking-wide">
                          {prop.type}
                        </span>
                        <h3 className="font-bold text-gray-900 mt-1">{prop.title}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" /> {prop.area}
                        </p>
                        <p className="text-indigo-600 font-bold mt-2">₹{prop.price}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Column: Interactive Leaflet Map */}
            <div className="lg:col-span-7">
              <PropertyMap properties={mapProperties} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}