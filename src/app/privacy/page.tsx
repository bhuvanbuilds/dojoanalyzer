import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Dojo Belt Analyzer collects, uses and protects your information.",
};

const UPDATED = "October 24, 2026";
const CONTACT = "kalvium.dojo@gmail.com";

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Who we are",
    body: [
      "Dojo Belt Analyzer is an internal tool for Kalvium campuses. It shows students, mentors and campus staff how belts are earned in the weekly Dojo belt tests.",
    ],
  },
  {
    title: "Information we collect",
    body: [
      "Google sign-in: when you sign in with Google we receive your name, email address and profile photo. We don’t receive your Google password and we don’t access your Gmail, Drive or other Google data.",
      "Academic data: belt test results imported by your campus (student name, email, squad, test dates and belt levels in each language).",
      "Account details: your role (for example student, mentor or campus manager), your university and, for mentors, the squads you look after.",
      "Things you send us: access requests and support tickets, including any messages you write.",
      "Basic technical data: the page you were on and your browser when you file a ticket, and standard server logs used to keep the service working.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To sign you in and show you the data your role allows: your own progress for students, your squads for mentors, your campus for campus managers.",
      "To build dashboards, leaderboards and progress charts for your campus.",
      "To answer access requests and support tickets, and to email you about them.",
      "We don’t sell your information, and we don’t use it for advertising.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "Leaderboards show student names, squads and belt totals to signed-in users of the app.",
      "Detailed student history is limited to staff of the student’s own campus (and, for mentors, their own squads) and to the app’s administrators.",
      "Our service providers process data on our behalf: Supabase (database, sign-in and file storage), Google (sign-in) and Resend (email delivery).",
    ],
  },
  {
    title: "Storage and security",
    body: [
      "Data is stored with Supabase. Access is checked on the server for every request, database tables use row-level security, and connections are encrypted.",
      "We keep data for as long as your campus uses the tool. Administrators can remove accounts and student records at any time.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "We use essential cookies only: to keep you signed in, and a small preference for things like light or dark mode. We don’t use advertising or tracking cookies.",
    ],
  },
  {
    title: "Your choices",
    body: [
      `You can ask to see, correct or delete your information by emailing ${CONTACT} or by filing a ticket from the Help button in the app.`,
      "You can sign out at any time and remove the app’s access from your Google account settings.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If this policy changes we’ll update the date at the top of this page.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-page px-4 py-12 text-ink sm:py-16">
      <article className="mx-auto w-full max-w-2xl">
        <Link href="/login" aria-label="Dojo Belt Analyzer">
          <Image
            src="/imgs/kalvium_extended_logo.png"
            alt="Kalvium"
            width={2560}
            height={543}
            sizes="120px"
            className="h-6 w-auto"
          />
        </Link>
        <h1 className="mt-10 font-display text-[34px] font-bold leading-tight tracking-[-0.03em]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-[14px] text-muted">Dojo Belt Analyzer · Last updated {UPDATED}</p>

        <div className="mt-10 flex flex-col gap-9">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.015em]">{section.title}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="max-w-[68ch] text-[15px] leading-7 text-ink-2">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-line pt-6 text-[13px] text-muted">
          Questions? Email <span className="font-medium text-ink select-all">{CONTACT}</span>.
        </footer>
      </article>
    </main>
  );
}
