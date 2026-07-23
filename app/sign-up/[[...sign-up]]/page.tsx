import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
	return (
		<main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col items-center gap-10 px-6 py-12 lg:flex-row lg:items-start">
			<section className="max-w-xl space-y-4 lg:pt-10">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Get started</p>
				<h1 className="text-4xl font-semibold tracking-tight text-slate-950">Create an account and start building your workspace routine.</h1>
				<p className="text-sm leading-7 text-slate-600">
					Once you sign up, Mate-E can start tracking your workspace, guidance patterns, and recovery progress.
				</p>
				<Link href="/" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
					Return home
				</Link>
			</section>
			<div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
				<SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/app/workspace" />
			</div>
		</main>
	);
}