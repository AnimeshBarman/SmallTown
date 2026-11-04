import Link from "next/link";
import { Building2, Mail } from "lucide-react";

const footerGroups = [
  {
    title: "SmallTown",
    links: [
      { href: "/about", label: "About us" },
      { href: "/explore", label: "Explore places" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help & contact" },
      { href: "/feedback", label: "Share feedback" },
      { href: "/safety", label: "Rental safety tips" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white text-stone-700 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_2fr] md:py-14">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight text-stone-950 dark:text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <Building2 size={19} />
            </span>
            <span className="text-lg">SmallTown</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-stone-600 dark:text-stone-400">
            A simpler way to discover rooms, PGs and homes around Cooch Behar.
            Check the details, ask questions and make informed decisions.
          </p>
          <a
            href="mailto:smalltowntier3@gmail.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            <Mail size={15} /> smalltowntier3@gmail.com
          </a>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={`${group.title} links`}>
              <h2 className="text-sm font-semibold text-stone-950 dark:text-white">{group.title}</h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-stone-600 transition hover:text-emerald-800 dark:text-stone-400 dark:hover:text-emerald-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-stone-200 dark:border-stone-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-4 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:text-stone-500">
          <p>© SmallTown. All rights reserved.</p>
          <p>Local listings for Cooch Behar, West Bengal.</p>
        </div>
      </div>
    </footer>
  );
}
