import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Rental safety tips",
  description: "Practical tips for viewing a rental property and paying safely.",
};

const checks = [
  "Arrange a visit and inspect the actual property before committing. If possible, visit during daylight and take someone you trust.",
  "Ask for proof that the person you are speaking with owns the property or is authorized to offer it.",
  "Check the condition of the rooms, locks, water, electricity and facilities included in the offer. Ask questions about anything unclear.",
  "Be cautious if someone pressures you to pay immediately, refuses a visit, or offers a deal that seems unusually good.",
  "Do not share passwords, one-time passcodes, payment PINs or banking credentials with a property owner or anyone claiming to be support.",
  "Before paying, agree in writing on the amount, purpose, refund terms and any other conditions. Keep copies of messages and receipts.",
  "Prefer a traceable payment method and confirm the recipient details. Avoid sending money to an unrelated person or account.",
  "Read any rental agreement carefully and keep a copy signed by the relevant parties.",
];

export default function SafetyPage() {
  return (
    <InfoPage
      title="Rental safety tips"
      intro="A few practical checks can help you make a more informed decision when viewing a place or discussing payment."
    >
      <section>
        <h2 className="text-xl font-semibold text-stone-950 dark:text-white">Before you visit or pay</h2>
        <ul className="mt-4 space-y-4">
          {checks.map((check) => (
            <li key={check} className="flex gap-3">
              <Check size={19} className="mt-1 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <span>{check}</span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle size={20} className="mt-1 shrink-0" />
        <p>
          SmallTown does not verify every listing or guarantee a transaction. These tips
          are general information, not legal or financial advice. If you feel in immediate
          danger, leave the situation and contact local emergency services.
        </p>
      </aside>
      <p>
        See a suspicious listing? Contact{" "}
        <a className="font-semibold underline underline-offset-4" href="mailto:smalltowntier3@gmail.com">smalltowntier3@gmail.com</a>{" "}
        with its link and a brief explanation. For more help, visit{" "}
        <Link href="/help" className="font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300">
          Help & contact
        </Link>.
      </p>
    </InfoPage>
  );
}
