"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Building2, Heart, UserRound } from "lucide-react";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeToAuth } from "@/lib/auth-state";

const links = [
  { href: "/explore", label: "Explore", mobileLabel: "Find" },
  { href: "/properties/new", label: "List a place", mobileLabel: "List" },
  { href: "/account", label: "Account", mobileLabel: "Me" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const signedIn = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Building2 size={19} />
          </span>
          <span className="text-lg">SmallTown</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                pathname === link.href
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <span className="sm:hidden">{link.mobileLabel}</span>
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
            <Link href="/login?next=%2Faccount" aria-label="Sign in" className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 sm:px-4">
              <UserRound size={15} /> <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
