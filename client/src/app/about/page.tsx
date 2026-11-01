import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "About SmallTown",
  description: "Learn about SmallTown, a local property-listing service for Cooch Behar.",
};

export default function AboutPage() {
  return (
    <InfoPage
      title="A more local way to find a place"
      intro="SmallTown helps people discover rooms, PGs and homes in and around Cooch Behar, West Bengal."
    >
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">What we do</h2>
        <p className="mt-3">
          We bring local property listings together so people can compare places, see useful
          details and contact a listing owner. You can save places to revisit and post a
          listing if you have a place to offer.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">A note about listings</h2>
        <p className="mt-3">
          SmallTown is a listing platform, not a property owner or rental agent. Listings
          are provided by users. Please independently confirm the property, the person
          offering it, the terms and any payment request before making a decision.
        </p>
      </section>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
        <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">Get in touch</h2>
        <p className="mt-2">
          Have a question or suggestion? Email{" "}
          <a className="font-semibold underline underline-offset-4" href="mailto:smalltowntier3@gmail.com">
            smalltowntier3@gmail.com
          </a>.
        </p>
      </section>
    </InfoPage>
  );
}
