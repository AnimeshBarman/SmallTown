"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Building2, Heart, Moon, Plus, Search, Sun, UserRound } from "lucide-react";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeToAuth } from "@/lib/auth-state";
import { getServerThemeSnapshot, getThemeSnapshot, setTheme, subscribeToTheme } from "@/lib/theme";

const links = [
  { href: "/explore", label: "Explore", mobileLabel: "Find", icon: Search },
  { href: "/properties/new", label: "List a place", mobileLabel: "List", icon: Plus },
  { href: "/account", label: "Account", mobileLabel: "Me", icon: UserRound },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 max-[380px]:gap-2 max-[380px]:px-2 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Building2 size={19} />
          </span>
          <span className="text-lg max-[380px]:hidden">SmallTown</span>
        </Link>

        <div className="flex items-center gap-1 max-[380px]:gap-0 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              aria-label={link.label}
              href={link.href}
              className={`rounded-full px-2 py-2 text-xs font-medium transition max-[380px]:px-1.5 sm:px-3 sm:text-sm ${
                pathname === link.href
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <span className="sm:hidden max-[380px]:hidden">{link.mobileLabel}</span>
              <link.icon className="hidden max-[380px]:inline sm:hidden" size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          ))}
          {signedIn ? (
            <Link
              href="/account#saved"
              aria-label="Saved listings"
              className="hidden rounded-full p-2 text-stone-600 hover:bg-stone-100 sm:block"
            >
              <Heart size={18} />
            </Link>
          ) : (
            <Link href="/login?next=%2Faccount" aria-label="Sign in" className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 max-[380px]:ml-0 max-[380px]:px-2 sm:px-4">
              <UserRound size={15} /> <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
          <button
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100 max-[380px]:ml-0"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </nav>
    </header>
  );
}
