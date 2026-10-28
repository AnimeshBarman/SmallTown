const authChangedEvent = "smalltown-auth-changed";

export function isAuthenticated() {
  return typeof window !== "undefined" && Boolean(localStorage.getItem("access_token"));
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
  return isAuthenticated();
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

export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(authChangedEvent));
  }
}
