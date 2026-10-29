"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Turnstile = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

type TurnstileCaptchaProps = {
  onTokenChange: (token: string | null) => void;
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function TurnstileCaptcha({ onTokenChange }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    const turnstile = window.turnstile;
    const container = containerRef.current;
    if (!scriptReady || !SITE_KEY || !turnstile || !container) return;

    const widgetId = turnstile.render(container, {
      sitekey: SITE_KEY,
      action: "listing",
      callback: (token) => {
        setError("");
        onTokenChangeRef.current(token);
      },
      "expired-callback": () => {
        onTokenChangeRef.current(null);
      },
      "error-callback": () => {
        onTokenChangeRef.current(null);
        setError("Security check failed to load. Please refresh the challenge.");
      },
    });

    return () => {
      turnstile.remove(widgetId);
      onTokenChangeRef.current(null);
    };
  }, [scriptReady]);

  if (!SITE_KEY) {
    return (
      <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Listing verification isn&apos;t configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY to enable publishing.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError("Could not load the security check. Check your connection and try again.")}
      />
      <div ref={containerRef} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
