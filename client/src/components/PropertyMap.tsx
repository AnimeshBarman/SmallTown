"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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
  area?: string | null;
  price: number;
  type: string;
  image_urls?: string[];
  latitude: number;
  longitude: number;
}

interface PropertyMapProps {
  properties: Property[];
  center?: [number, number];
  selectable?: boolean;
  selectedLocation?: [number, number] | null;
  bounds?: [[number, number], [number, number]];
  className?: string;
  onLocationSelect?: (location: [number, number]) => void;
  onPropertySelect?: (propertyId: string | number) => void;
}

export default function PropertyMap({ 
  properties, 
  center = [26.323, 89.451],
  selectable = false,
  selectedLocation = null,
  bounds,
  className = "h-96",
  onLocationSelect,
  onPropertySelect,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const locationSelectRef = useRef(onLocationSelect);
  const propertySelectRef = useRef(onPropertySelect);
  const initialMapConfig = useRef({ center, selectable, bounds });
  const [centerLatitude, centerLongitude] = center;

  useEffect(() => {
    initialMapConfig.current = {
      center: [centerLatitude, centerLongitude],
      selectable,
      bounds,
    };
  }, [centerLatitude, centerLongitude, selectable, bounds]);

  useEffect(() => {
    locationSelectRef.current = onLocationSelect;
    propertySelectRef.current = onPropertySelect;
  }, [onLocationSelect, onPropertySelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const config = initialMapConfig.current;
    const map = L.map(container, {
      scrollWheelZoom: false,
      maxBounds: config.selectable ? config.bounds : undefined,
      maxBoundsViscosity: config.selectable && config.bounds ? 0.8 : undefined,
    }).setView(config.center, config.selectable ? 12 : 13);
    const markerLayer = L.layerGroup().addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const handleClick = (event: L.LeafletMouseEvent) => {
      locationSelectRef.current?.([event.latlng.lat, event.latlng.lng]);
    };
    if (selectable) map.on("click", handleClick);

    mapRef.current = map;
    markerLayerRef.current = markerLayer;
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.off("click", handleClick);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
      if (markerLayerRef.current === markerLayer) markerLayerRef.current = null;
    };
  }, [selectable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getContainer().isConnected || !map.getPane("mapPane")) return;
    map.setView([centerLatitude, centerLongitude], map.getZoom());
    map.setMaxBounds(selectable ? bounds : undefined);
    map.invalidateSize();
  }, [centerLatitude, centerLongitude, bounds, selectable]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    markerLayer.clearLayers();

    if (selectedLocation) {
      L.marker(selectedLocation, { icon: customIcon }).addTo(markerLayer);
    }

    for (const property of properties) {
      if (
        !Number.isFinite(property.latitude) ||
        property.latitude < -90 ||
        property.latitude > 90 ||
        !Number.isFinite(property.longitude) ||
        property.longitude < -180 ||
        property.longitude > 180
      ) {
        continue;
      }

      const popup = document.createElement("div");
      popup.className = "max-w-xs p-2";
      if (property.image_urls?.[0]) {
        const image = document.createElement("img");
        image.src = property.image_urls[0];
        image.alt = property.title;
        image.loading = "lazy";
        image.className = "mb-2 h-28 w-full rounded-md bg-stone-100 object-contain";
        popup.append(image);
      }

      const title = document.createElement("h4");
      title.className = "font-bold text-gray-900";
      title.textContent = property.title;
      popup.append(title);

      const area = document.createElement("p");
      area.className = "text-sm text-gray-600";
      area.textContent = property.area ?? "";
      popup.append(area);

      const price = document.createElement("p");
      price.className = "mt-1 text-sm font-semibold text-indigo-600";
      price.textContent = `₹${property.price} / month`;
      popup.append(price);

      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "mt-2 inline-block rounded bg-indigo-600 px-3 py-1 text-xs text-white transition hover:bg-indigo-700";
      button.textContent = "View Details";
      button.addEventListener("click", () => propertySelectRef.current?.(property.id));
      popup.append(button);

      L.marker([property.latitude, property.longitude], { icon: customIcon })
        .bindPopup(popup)
        .addTo(markerLayer);
    }
  }, [properties, selectedLocation]);

  return (
    <div
      ref={containerRef}
      className={`${className} w-full overflow-hidden rounded-2xl border border-gray-200 shadow-lg`}
    />
  );
}