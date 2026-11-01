import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Help & contact",
  description: "Get help with SmallTown accounts, listings and suspicious content.",
};

export default function HelpPage() {
  return (
    <InfoPage
      title="How can we help?"
      intro="For questions about your account, a listing or using SmallTown, contact our support email. Include enough detail for us to understand the issue, but never send your password or sign-in codes."
    >
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
        <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">Contact support</h2>
        <a
          href="mailto:smalltowntier3@gmail.com"
          className="mt-3 inline-flex items-center gap-2 font-semibold text-emerald-900 underline underline-offset-4 dark:text-emerald-200"
        >
          <Mail size={17} /> smalltowntier3@gmail.com
        </a>
        <p className="mt-3 text-sm">Please include the listing link or the email on your account when relevant.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Common questions</h2>
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="font-semibold text-stone-950 dark:text-white">How do I report a listing?</h3>
            <p className="mt-1">Email us the listing link and a short description of your concern. If there is an immediate safety risk, contact local emergency services.</p>
          </div>
          <div>
            <h3 className="font-semibold text-stone-950 dark:text-white">How do I change or remove my listing?</h3>
            <p className="mt-1">Sign in and open your account to manage your listings. If you cannot access your account, contact support.</p>
          </div>
          <div>
            <h3 className="font-semibold text-stone-950 dark:text-white">Does SmallTown verify every property?</h3>
            <p className="mt-1">No. Listings are provided by users. Check the property and the person offering it independently before paying or signing anything.</p>
          </div>
        </div>
      </section>
      <p>
        For practical precautions before visiting a property or making a payment, read our{" "}
        <Link href="/safety" className="font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300">
          rental safety tips
        </Link>.
      </p>
    </InfoPage>
  );
}
