import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { ForgeHammer } from "@/components/forge-hammer";
import { ForgeSky } from "@/components/forge-sky";
import { inks } from "@/lib/palette";
import { shareMeta } from "@/lib/site-meta";
import { CSP } from "@/lib/csp";
import { AuthProvider } from "@/lib/auth/provider";
import { MissingPage } from "@/components/missing-page";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Anagram Forge";

export const Route = createRootRoute({
  notFoundComponent: MissingPage,
  headers: () => {
    if (!import.meta.env.PROD) return undefined;
    return { "Content-Security-Policy": CSP };
  },
  head: ({ matches }) => {
    const path = matches[matches.length - 1]?.pathname || "/";
    const share = shareMeta(path);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...share.meta,
        { name: "apple-mobile-web-app-title", content: APP_NAME },
        { name: "theme-color", content: inks.soot },
      ],
      links: [
        ...share.links,
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      ],
    };
  },
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("af-type")==="easy")document.documentElement.classList.add("easy-read")}catch(e){}`,
          }}
        />
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-bg text-fg">
        <PreviewHostBridge />
        <ForgeSky />
        <ForgeHammer />
        <div className="relative z-10">
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        </div>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            className: "bg-raised text-fg border-border",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
