import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
	return (
		<main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col items-center gap-10 px-6 py-12 lg:flex-row lg:items-start">
			<section className="max-w-xl space-y-4 lg:pt-10">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Workspace access</p>
				<h1 className="text-4xl font-semibold tracking-tight text-slate-950">Sign in to continue your workspace.</h1>
				<p className="text-sm leading-7 text-slate-600">
					Your workspace, recent progress, and guided continuity live behind your personal account.
				</p>
				<Link href="/" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
					Return home
				</Link>
			</section>
			<div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
				<SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/app/workspace" />
			</div>
		</main>
	);
}
