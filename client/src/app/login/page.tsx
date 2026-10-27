"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isAuthenticating = useRef(false);

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
      const response = await api.post<{ access_token: string; refresh_token: string }>("/auth/google", {
        id_token: credentialResponse.credential,
      });

      const { access_token, refresh_token } = response.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);

      router.push("/properties/new");
    } catch (error: unknown) {
      const detail = isAxiosError<{ detail?: string }>(error)
        ? error.response?.data?.detail
        : undefined;
      setErrorMessage(
        detail || (error instanceof Error ? error.message : "Google authentication failed.")
      );
    } finally {
      isAuthenticating.current = false;
      setIsLoading(false);
    }
  }, [router]);

  const handleGoogleError = useCallback(() => {
    setErrorMessage("Google Sign-In was unsuccessful. Please try again.");
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Building2 className="w-12 h-12 text-indigo-600 mx-auto" />
            <h2 className="mt-4 text-3xl font-extrabold text-gray-900">Welcome to SmallTown</h2>
            <p className="mt-2 text-sm text-gray-600">Secure, verified student rooms without the brokerage hassle.</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
              {errorMessage}
            </div>
          )}

          <Card className="shadow-lg border-gray-200">
            <CardHeader className="text-center">
              <CardTitle>Sign in to continue</CardTitle>
              <CardDescription>Use your Google account for instant access.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pb-8">
              <div className="w-full flex flex-col items-center justify-center gap-3">
                <div className="relative w-full flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    size="large"
                    shape="pill"
                  />
                  {isLoading && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 z-10 cursor-wait bg-white/50"
                    />
                  )}
                </div>
                {isLoading && (
                  <div role="status" className="flex items-center gap-2 text-indigo-600 py-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm font-medium">Verifying with FastAPI...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </GoogleOAuthProvider>
    </main>
  );
}