"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FeedbackCategory = "bug" | "idea" | "general";

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item && typeof item === "object" && "msg" in item ? item.msg : null)
        .filter((message): message is string => typeof message === "string");
      if (messages.length) return messages.join("; ");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Feedback could not be submitted. Please try again.";
}

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ message: string }>("/feedback", {
        category,
        message,
        email: email.trim() || null,
        website,
      });
      return data;
    },
    onSuccess: () => {
      setCategory("idea");
      setMessage("");
      setEmail("");
      setWebsite("");
    },
  });

  return (
    <main className="min-h-[70vh] flex-1 bg-[#faf9f6] px-4 py-10 text-stone-900 dark:bg-stone-900 dark:text-stone-100 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          <ArrowLeft size={16} /> Back to exploring
        </Link>

        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
            Your voice matters
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Help make SmallTown better</h1>
          <p className="mt-3 max-w-xl leading-7 text-stone-600 dark:text-stone-300">
            Tell us what is working, what is confusing, or what would make finding a place easier.
          </p>
        </div>

        <Card className="mt-7 rounded-3xl border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-950 sm:p-8">
          {feedbackMutation.isSuccess ? (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <h2 className="font-semibold">Thank you for your feedback!</h2>
              <p className="mt-1 text-sm">We appreciate you helping us improve SmallTown.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => feedbackMutation.reset()}
                className="mt-4 rounded-full"
              >
                Send more feedback
              </Button>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                feedbackMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <label htmlFor="feedback-category" className="text-sm font-medium">What is your feedback about?</label>
                <select
                  id="feedback-category"
                  value={category}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "bug" || value === "idea" || value === "general") {
                      setCategory(value);
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-stone-700 dark:bg-stone-900"
                >
                  <option value="idea">Feature idea</option>
                  <option value="bug">Something is not working</option>
                  <option value="general">General feedback</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="feedback-message" className="text-sm font-medium">Your feedback</label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  minLength={10}
                  maxLength={2000}
                  rows={6}
                  required
                  placeholder="Share a suggestion or describe what happened…"
                  className="min-h-36 rounded-xl border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900"
                />
                <p className="text-right text-xs text-stone-500">{message.length}/2000</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="feedback-email" className="text-sm font-medium">
                  Email <span className="font-normal text-stone-500">(optional, if you would like a reply)</span>
                </label>
                <Input
                  id="feedback-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900"
                />
              </div>

              <div
                aria-hidden="true"
                className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
              >
                <label htmlFor="feedback-website">Leave this field empty</label>
                <input
                  id="feedback-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {feedbackMutation.isError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {getErrorMessage(feedbackMutation.error)}
                </p>
              )}

              <Button
                type="submit"
                disabled={feedbackMutation.isPending || message.trim().length < 10}
                className="h-11 w-full rounded-full bg-emerald-700 font-semibold text-white hover:bg-emerald-800"
              >
                {feedbackMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                {feedbackMutation.isPending ? "Sending…" : "Send feedback"}
              </Button>
              <p className="text-center text-xs text-stone-500">
                Please don&apos;t include passwords, payment information, or other sensitive details.
              </p>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
