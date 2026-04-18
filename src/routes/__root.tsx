import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Budget Tracker" },
      { name: "description", content: "Track your yearly budget and spending in £." },
      { property: "og:title", content: "Budget Tracker" },
      { name: "twitter:title", content: "Budget Tracker" },
      { property: "og:description", content: "Track your yearly budget and spending in £." },
      { name: "twitter:description", content: "Track your yearly budget and spending in £." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/VNt13HRloGPD77zNbeR0ih2LJ0t1/social-images/social-1776545805398-Screenshot_2026-04-18_215111.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/VNt13HRloGPD77zNbeR0ih2LJ0t1/social-images/social-1776545805398-Screenshot_2026-04-18_215111.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
