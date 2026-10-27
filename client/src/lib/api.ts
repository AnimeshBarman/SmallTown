import axios, { type InternalAxiosRequestConfig } from "axios";

const API_VERSION_PATH = "/api/v1";
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
const apiBaseUrl = configuredApiUrl?.endsWith(API_VERSION_PATH)
  ? configuredApiUrl
  : configuredApiUrl
    ? `${configuredApiUrl}${API_VERSION_PATH}`
    : undefined;

export const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || typeof window === "undefined") {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const requestUrl = originalRequest?.url ?? "";
    const isAuthRequest = ["/auth/google", "/auth/login", "/auth/refresh"].some(
      (path) => requestUrl.includes(path)
    );

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRequest
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      localStorage.removeItem("access_token");
      window.location.assign(new URL("/login", window.location.origin).toString());
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= api
        .post<{ access_token: string; refresh_token?: string }>("/auth/refresh", {
          refresh_token: refreshToken,
        })
        .then(({ data }) => {
          localStorage.setItem("access_token", data.access_token);
          if (data.refresh_token) {
            localStorage.setItem("refresh_token", data.refresh_token);
          }
          return data.access_token;
        })
        .finally(() => {
          refreshPromise = null;
        });

      const accessToken = await refreshPromise;
      originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
      return api(originalRequest);
    } catch (refreshError: unknown) {
      if (
        axios.isAxiosError(refreshError) &&
        refreshError.response?.status === 401
      ) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.assign(new URL("/login", window.location.origin).toString());
      }

      return Promise.reject(refreshError);
    }
  }
);