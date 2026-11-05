const authChangedEvent = "smalltown-auth-changed";
let authenticated = false;
let authRevision = 0;

export function isAuthenticated() {
  return authenticated;
}

export function subscribeToAuth(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener(authChangedEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(authChangedEvent, callback);
  };
}

export function getAuthSnapshot() {
  return authenticated;
}

export function getServerAuthSnapshot() {
  return false;
}

export function getLogoutWarningSnapshot() {
  return typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("logout") === "failed";
}

export function getServerLogoutWarningSnapshot() {
  return false;
}

export function setAuthenticated(value: boolean) {
  authenticated = value;
  authRevision += 1;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(authChangedEvent));
  }
}

export function getAuthRevision() {
  return authRevision;
}

export function setAuthenticatedIfUnchanged(value: boolean, expectedRevision: number) {
  if (authRevision === expectedRevision) {
    setAuthenticated(value);
  }
}
