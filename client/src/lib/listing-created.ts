const listingCreatedEvent = "smalltown-listing-created";
const listingCreatedKey = "smalltown:last-created-listing";

export function subscribeToCreatedListing(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(listingCreatedEvent, callback);
  return () => window.removeEventListener(listingCreatedEvent, callback);
}

export function getCreatedListingSnapshot() {
  return typeof window === "undefined" ? null : sessionStorage.getItem(listingCreatedKey);
}

export function getServerCreatedListingSnapshot() {
  return null;
}

export function markListingCreated(propertyId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(listingCreatedKey, propertyId);
  window.dispatchEvent(new Event(listingCreatedEvent));
}

export function clearCreatedListing() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(listingCreatedKey);
  window.dispatchEvent(new Event(listingCreatedEvent));
}
