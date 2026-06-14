import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Mate-E",
  description: "Privacy policy for Mate-E.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Privacy Policy - Mate-E</h1>
        <p className="mt-3 text-sm text-slate-500">Effective Date: May 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-700 sm:text-base">
          <section>
            <p>
              Mate-E respects your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Information We Collect</h2>
            <p className="mt-2">Mate-E may collect the following information:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Account information such as email address and authentication identifiers</li>
              <li>User-generated content including notes, whiteboards, uploads, and AI interactions</li>
              <li>Device and usage information used for app functionality, analytics, security, and debugging</li>
              <li>Log and diagnostic information related to crashes or service performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">How We Use Information</h2>
            <p className="mt-2">We use collected information to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide and maintain the Mate-E platform</li>
              <li>Authenticate users and secure accounts</li>
              <li>Enable productivity, collaboration, AI, and whiteboard functionality</li>
              <li>Improve app performance and reliability</li>
              <li>Prevent abuse, fraud, or unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Data Sharing</h2>
            <p className="mt-2">Mate-E does not sell personal information.</p>
            <p className="mt-2">
              Data may be processed by trusted service providers used to operate the platform, including cloud hosting, authentication, analytics, AI, and storage providers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Data Security</h2>
            <p className="mt-2">
              We take reasonable measures to protect user data, but no method of electronic storage or transmission is completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">User Content</h2>
            <p className="mt-2">Users are responsible for the content they upload or create within Mate-E.</p>
            <p className="mt-2">Do not upload illegal, harmful, or sensitive content you do not wish to store electronically.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Age Requirement</h2>
            <p className="mt-2">Mate-E is intended only for users who are 18 years of age or older.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Changes To This Policy</h2>
            <p className="mt-2">
              This Privacy Policy may be updated periodically. Continued use of Mate-E after updates constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Contact</h2>
            <p className="mt-2">For questions regarding this Privacy Policy, contact:</p>
            <p className="mt-3">
              <a className="font-medium text-teal-700 underline underline-offset-4" href="mailto:christianmueth@outlook.com">
                christianmueth@outlook.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}