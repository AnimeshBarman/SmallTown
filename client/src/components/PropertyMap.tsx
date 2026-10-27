"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";

const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface Property {
  id: string | number;
  title: string;
  area: string;
  price: number;
  type: string;
  image_urls?: string[];
  latitude: number;
  longitude: number;
}

interface PropertyMapProps {
  properties: Property[];
  center?: [number, number];
}

export default function PropertyMap({ 
  properties, 
  center = [26.7271, 88.3953] // Default: Siliguri coordinates 
}: PropertyMapProps) {
  return (
    <div className="h-150 w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={false} 
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties.map((prop) => (
          <Marker 
            key={prop.id} 
            position={[prop.latitude, prop.longitude]} 
            icon={customIcon}
          >
            <Popup>
              <div className="p-2 max-w-xs">
                {prop.image_urls && prop.image_urls[0] && (
                  <img 
                    src={prop.image_urls[0]} 
                    alt={prop.title} 
                    className="w-full h-28 object-cover rounded-md mb-2"
                  />
                )}
                <h4 className="font-bold text-gray-900">{prop.title}</h4>
                <p className="text-sm text-gray-600">{prop.area}</p>
                <p className="text-sm font-semibold text-indigo-600 mt-1">₹{prop.price} / month</p>
                <Link 
                  href={`/properties/${prop.id}`} 
                  className="inline-block mt-2 text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition"
                >
                  View Details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}