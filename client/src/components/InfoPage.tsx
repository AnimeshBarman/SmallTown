import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

type InfoPageProps = {
  title: string;
  intro: string;
  children: ReactNode;
  reviewDraft?: boolean;
};

export default function InfoPage({ title, intro, children, reviewDraft = false }: InfoPageProps) {
  return (
    <main className="flex-1 bg-[#faf9f6] px-4 py-10 text-stone-900 dark:bg-stone-900 dark:text-stone-100 sm:px-6 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          <ArrowLeft size={16} /> Back to SmallTown
        </Link>
        <header className="mt-8 border-b border-stone-200 pb-7 dark:border-stone-700">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
            SmallTown · Cooch Behar
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl leading-7 text-stone-600 dark:text-stone-300">{intro}</p>
        </header>

        {reviewDraft && (
          <aside className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>
              <strong>Review draft:</strong> This page is a starting point and has not been
              reviewed by a legal professional. Please review it against SmallTown&apos;s
              practices and applicable law before relying on it as a final policy.
            </p>
          </aside>
        )}

        <div className="info-page-content mt-8 space-y-8 text-[15px] leading-7 text-stone-700 dark:text-stone-300">
          {children}
        </div>
      </article>
    </main>
  );
}
