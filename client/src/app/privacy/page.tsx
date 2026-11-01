import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Review draft describing information used by SmallTown.",
};

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy policy"
      intro="This draft explains the kinds of information SmallTown currently uses to provide account, listing and search features."
      reviewDraft
    >
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Information used</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Account details such as your name and email address, plus an avatar if provided through Google sign-in.</li>
          <li>Listing details you submit, including property location, description, price, photos and a contact phone number.</li>
          <li>Saved-property choices and basic listing-view counts used by the app.</li>
          <li>When you report a listing, the selected reason and any details you provide are associated with your account so an administrator can review the report.</li>
          <li>Search text when you use search features. Some natural-language searches may be processed by Groq to identify search criteria.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">What other users can see</h2>
        <p className="mt-3">
          Property details and photos are shown to people browsing listings. Your listing
          name and contact phone may be shown with a listing so people can contact you.
          Do not include private information in a listing unless you intend to share it.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Report access and retention</h2>
        <p className="mt-3">
          Listing reports and reporter account details are available to SmallTown
          administrators for review. Moderation actions, including restriction reasons,
          administrator identity and timestamps, are recorded so owners can understand
          decisions and administrators can review history. Reports and moderation records
          may be kept as needed to investigate and document decisions. A specific
          retention period still needs to be established before this draft is finalized.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Service providers and storage</h2>
        <p className="mt-3">
          SmallTown uses service providers to operate features: Google for optional
          sign-in, Supabase Storage for listing photos, Groq for some AI-assisted searches,
          and backend database and Redis services for app data, temporary search caching
          and rate limiting. These services may process information needed for their
          respective features. The exact providers, settings and retention periods should
          be confirmed before this draft is finalized.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Browser storage</h2>
        <p className="mt-3">
          SmallTown stores sign-in tokens and your theme preference in your browser&apos;s
          local storage. A random browser identifier is also used to help count a
          property view once per day. Avoid staying signed in on a shared device and use
          the log-out option when finished.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Your choices and questions</h2>
        <p className="mt-3">
          You can edit or delete your listings and remove saved places from your account.
          To ask about account information or request assistance, email{" "}
          <a className="font-semibold underline underline-offset-4" href="mailto:smalltowntier3@gmail.com">smalltowntier3@gmail.com</a>.
          This draft does not yet set final retention, deletion or response timelines;
          those details need to be reviewed against actual operations and applicable law.
        </p>
      </section>
    </InfoPage>
  );
}
