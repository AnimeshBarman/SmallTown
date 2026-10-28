const selectedPropertyEvent = "smalltown-selected-property-changed";

export function subscribeToSelectedProperty(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("popstate", callback);
  window.addEventListener(selectedPropertyEvent, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(selectedPropertyEvent, callback);
  };
}

export function getSelectedPropertySnapshot() {
  return typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("property");
}

export function getServerSelectedPropertySnapshot() {
  return null;
}

export function setSelectedProperty(propertyId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (propertyId) {
    url.searchParams.set("property", propertyId);
  } else {
    url.searchParams.delete("property");
  }
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(selectedPropertyEvent));
}
