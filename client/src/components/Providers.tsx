"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import { getAuthRevision, setAuthenticatedIfUnchanged } from "@/lib/auth-state";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    let active = true;
    const authRevision = getAuthRevision();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    api.get("/auth/me", { _skipAuthRedirect: true })
      .then(() => {
        if (active) setAuthenticatedIfUnchanged(true, authRevision);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isAxiosError(error) && error.response?.status === 401) {
          setAuthenticatedIfUnchanged(false, authRevision);
          return;
        }
        console.error("Session verification failed; authentication state remains signed out.");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}