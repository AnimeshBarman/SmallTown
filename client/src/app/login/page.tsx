"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import {
  getLogoutWarningSnapshot,
  getServerLogoutWarningSnapshot,
  notifyAuthChanged,
  subscribeToAuth,
} from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2 } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

type AuthResponse = { access_token: string; refresh_token: string };

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || error.message;
  }
  return error instanceof Error ? error.message : "Authentication failed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const logoutWarning = useSyncExternalStore(
    subscribeToAuth,
    getLogoutWarningSnapshot,
    getServerLogoutWarningSnapshot
  );
  const isAuthenticating = useRef(false);

  const finishLogin = useCallback((tokens: AuthResponse) => {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    notifyAuthChanged();

    const returnTo = new URLSearchParams(window.location.search).get("next");
    const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/explore";
    router.push(safeReturnTo);
  }, [router]);

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    setIsLoading(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const fullname = String(formData.get("fullname") || "").trim();

    try {
      if (mode === "signup") {
        await api.post("/auth/signup", { email, password, fullname });
      }

      const loginForm = new URLSearchParams();
      loginForm.set("username", email);
      loginForm.set("password", password);
      const { data } = await api.post<AuthResponse>("/auth/login", loginForm, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      finishLogin(data);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      isAuthenticating.current = false;
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = useCallback(async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setErrorMessage("Google did not return an ID token. Please try again.");
      return;
    }
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const { data } = await api.post<AuthResponse>("/auth/google", {
        id_token: credentialResponse.credential,
      });
      finishLogin(data);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      isAuthenticating.current = false;
      setIsLoading(false);
    }
  }, [finishLogin]);

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-[#faf9f6] px-4 py-8 sm:px-6">
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <Building2 className="mx-auto h-11 w-11 text-emerald-700" />
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
              {mode === "login" ? "Welcome back" : "Find your place"}
            </h1>
            <p className="mt-2 text-sm text-stone-600">Sign in to save homes and manage your listings.</p>
          </div>

          {logoutWarning && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You are signed out on this device. We couldn&apos;t confirm server-side session revocation.
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <Card className="border-stone-200 shadow-lg">
            <CardHeader className="pb-3">
              <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1">
                {(["login", "signup"] as const).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    variant={mode === tab ? "default" : "ghost"}
                    onClick={() => {
                      setMode(tab);
                      setErrorMessage("");
                    }}
                    className={mode === tab ? "h-10 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800" : "h-10 rounded-lg"}
                  >
                    {tab === "login" ? "Sign in" : "Create account"}
                  </Button>
                ))}
              </div>
              <CardTitle className="pt-4 text-xl">{mode === "login" ? "Sign in to SmallTown" : "Create your account"}</CardTitle>
              <CardDescription>{mode === "login" ? "Pick up where you left off." : "It only takes a moment to get started."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname">Full name</Label>
                    <Input id="fullname" name="fullname" autoComplete="name" minLength={2} maxLength={100} required />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={64} required />
                  {mode === "signup" && <p className="text-xs text-stone-500">Use at least 8 characters.</p>}
                </div>
                <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
                  {isLoading ? <><Loader2 className="animate-spin" /> Please wait…</> : mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>

              {GOOGLE_CLIENT_ID && (
                <>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span className="h-px flex-1 bg-stone-200" /> OR <span className="h-px flex-1 bg-stone-200" />
                  </div>
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setErrorMessage("Google Sign-In was unsuccessful. Please try again.")}
                      theme="outline"
                      size="large"
                      shape="pill"
                      text="signin_with"
                      context="signin"
                      ux_mode="popup"
                      auto_select={false}
                      use_fedcm_for_button={false}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </GoogleOAuthProvider>
    </main>
  );
}
