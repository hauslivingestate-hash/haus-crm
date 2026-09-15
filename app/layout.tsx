import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

// ROOT layout — html/body/fonts only, deliberately NO app chrome and NO providers.
//
// The signed-in application lives in the `(app)` route group, whose layout carries the
// Sidebar, the FAB and every in-memory store. `/login` sits outside that group, so a
// signed-out visitor gets none of it: no nav (which would leak the whole surface map) and
// no app state instantiated at all.
//
// Route groups don't affect URLs — `app/(app)/leads` is still `/leads`.

const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HAUS CRM — Living Estate",
  description: "ระบบ CRM อสังหาฯ Haus Living Estate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is for ONE attribute: next-themes writes class="dark" on
    // <html> before React hydrates, and that is the only thing here that differs from
    // the server markup.
    <html lang="th" className={`${plexSansThai.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
