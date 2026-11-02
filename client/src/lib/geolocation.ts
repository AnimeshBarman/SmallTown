export function getCurrentCoordinates(): Promise<[number, number]> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.reject(new Error("This device or browser does not support location access."));
  }

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (!window.isSecureContext && !isLocalhost) {
    return Promise.reject(
      new Error("GPS requires a secure HTTPS page. Open SmallTown over HTTPS, then allow location access."),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve([coords.latitude, coords.longitude]),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access in your browser settings or place the pin manually."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Your current location is unavailable. Try again or place the pin manually."
            : "Getting your location timed out. Try again or place the pin manually.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}
