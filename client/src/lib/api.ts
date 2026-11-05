import axios, { type InternalAxiosRequestConfig } from "axios";
import { setAuthenticated } from "@/lib/auth-state";

const API_VERSION_PATH = "/api/v1";

declare module "axios" {
  export interface AxiosRequestConfig {
    _skipAuthRedirect?: boolean;
  }
}

export const api = axios.create({
  baseURL: API_VERSION_PATH,
  withCredentials: true,
});

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<void> | null = null;

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

    originalRequest._retry = true;

    try {
      refreshPromise ??= api
        .post("/auth/refresh", undefined, { _skipAuthRedirect: true })
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null;
        });

      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError: unknown) {
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
        setAuthenticated(false);
        if (!originalRequest._skipAuthRedirect) {
          window.location.assign(new URL("/login", window.location.origin).toString());
        }
      }

      return Promise.reject(refreshError);
    }
  }
);