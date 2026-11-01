import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Draft terms for using SmallTown's property-listing service.",
};

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of service"
      intro="These draft terms describe basic expectations for using SmallTown to browse, save or post local property listings."
      reviewDraft
    >
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Using SmallTown</h2>
        <p className="mt-3">
          Use the service lawfully and provide accurate information when creating an
          account or posting a listing. Keep your sign-in details secure and tell us if
          you believe your account is being used without permission.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Listings and user conduct</h2>
        <p className="mt-3">
          Only post places you are authorized to advertise. Do not post misleading,
          fraudulent, unlawful, discriminatory or harmful content, impersonate someone,
          or share another person&apos;s information or images without permission. Listing
          owners are responsible for the accuracy and currency of their listing details.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Independent decisions</h2>
        <p className="mt-3">
          SmallTown provides a way to discover listings and contact users. We do not own
          or control listed properties and are not a party to discussions, rental
          agreements, visits or payments between users. We do not guarantee that a
          listing, user, property or offer is accurate, available, safe or suitable.
          Verify all relevant details independently before proceeding.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Content and account action</h2>
        <p className="mt-3">
          You retain responsibility for the content you submit and should only upload
          images and information you are permitted to share. SmallTown may review reports
          and take action on content or accounts that appear to violate these terms or
          create risk, subject to applicable law.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Questions</h2>
        <p className="mt-3">
          Contact <a className="font-semibold underline underline-offset-4" href="mailto:smalltowntier3@gmail.com">smalltowntier3@gmail.com</a>{" "}
          about these draft terms. These terms need legal review and may be updated before
          they are adopted as a final policy.
        </p>
      </section>
    </InfoPage>
  );
}
