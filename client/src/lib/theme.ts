const themeChangeEvent = "smalltown-theme-changed";
const themeStorageKey = "smalltown-theme";

export type Theme = "light" | "dark";

export function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
}

export function getServerThemeSnapshot(): Theme {
  return "light";
}

export function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(themeChangeEvent, callback);
  return () => window.removeEventListener(themeChangeEvent, callback);
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(themeStorageKey, theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}
