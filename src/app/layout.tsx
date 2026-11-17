import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Golos_Text, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import { getAsyncRuntimeConfig } from '@/lib/server/runtime-config'
import { TouchProvider } from '@/components/ui/hybrid-tooltip'
import { Analytics } from "@vercel/analytics/next"
import { config as appConfig } from "@/lib/config";
import { Suspense } from 'react';
import { RuntimeConfigScript } from '@/components/RuntimeConfigScript';

const sansFlex = Golos_Text({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-golos',
  adjustFontFallback: true,
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#141414' },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const { basePath, appPublicUrl } = await getAsyncRuntimeConfig();
  const url = appPublicUrl.startsWith('http') ? appPublicUrl : `https://${appPublicUrl}`;
  const tagline = "Swipe on what to watch next, by yourself or together.";
  
  return {
    metadataBase: new URL(url),
    title: {
      default: "Messer Swipe",
      template: "%s | Messer Swipe"
    },
    description: tagline,
    appleWebApp: { capable: true, title: "Messer Swipe", statusBarStyle: "black-translucent" },
    icons: {
      icon: [
        { url: `${basePath}/favicon.svg`, type: "image/svg+xml" },
        { url: `${basePath}/favicon-32.png`, sizes: "32x32", type: "image/png" },
      ],
      shortcut: `${basePath}/favicon-32.png`,
      apple: `${basePath}/apple-touch-icon.png`,
    },
    openGraph: {
      title: "Messer Swipe – Discover what to watch next",
      description: tagline,
      url: url,
      siteName: "Messer Swipe",
      images: [{ url: `${basePath}/og.png`, width: 1200, height: 630, alt: "Messer Swipe" }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Messer Swipe – Discover what to watch next",
      description: tagline,
    },
  };
}


// next-themes owns the class; this script only renames the key it reads. `theme` was its default
// before the canon's `messer-theme` (STANDARD 3.6), so an existing choice is moved once, before
// next-themes' own blocking script runs, instead of being silently forgotten.
const themeKeyBoot = `try{var t=localStorage.getItem("messer-theme");if(!t){var o=localStorage.getItem("theme");if(o){localStorage.setItem("messer-theme",o);localStorage.removeItem("theme");t=o}}}catch(e){}`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const useAnalytics = appConfig.USE_ANALYTICS

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeKeyBoot }} />
        <Suspense>
          <RuntimeConfigScript />
        </Suspense>
      </head>
      <body className={`${sansFlex.variable} ${jetbrainsMono.variable} overflow-y-hidden`}>
        {useAnalytics && <Analytics/>}

        <Providers
          attribute="class"
          storageKey="messer-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TouchProvider>
            {children}
          </TouchProvider>
        </Providers>

      </body>
    </html>
  )
}
