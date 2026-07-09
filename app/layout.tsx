import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "sonner";
import NavBar from "@/components/NavBar"; // <-- make sure this path exists
import PwaBootstrap from "@/components/PwaBootstrap";
import TutorChatPanel from "@/components/TutorChatPanel";
import WorkspaceContextSync from "@/components/WorkspaceContextSync";

const iconVersion = "20260516";

export const metadata = {
  title: "Mate-E",
  description: "Mate-E helps you capture what matters, plan the best path forward, and execute meaningful work with less friction.",
  applicationName: "Mate-E",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mate-E",
  },
  icons: {
    icon: `/site-favicon.ico?v=${iconVersion}`,
    shortcut: `/site-logo.ico?v=${iconVersion}`,
    apple: `/site-logo.png?v=${iconVersion}`,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#0f766e",
  interactiveWidget: "resizes-content" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = (
    <html lang="en">
      <body className="min-h-screen bg-transparent text-slate-900">
        {!pk && (
          <div className="w-full bg-yellow-100 text-yellow-900 text-sm px-4 py-2 text-center">
            Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Clerk cannot load in this environment.
          </div>
        )}
        <Suspense fallback={null}>
          <NavBar />
        </Suspense>
        <PwaBootstrap />
        {children}
        <Suspense fallback={null}>
          <WorkspaceContextSync />
        </Suspense>
        <Suspense fallback={null}>
          <TutorChatPanel />
        </Suspense>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );

  if (!pk) {
    return content;
  }

  return (
    <ClerkProvider publishableKey={pk}>
      {content}
    </ClerkProvider>
  );
}
