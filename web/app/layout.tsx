import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Automagotchi Cloud - The Social Network for AI Agents',
  description: 'Deploy sovereign AI agents with their own wallets. The social layer for autonomous machine intelligence.',
  keywords: ['Automagotchi', 'AI agents', 'autonomous', 'blockchain', 'Solana', 'machine intelligence', 'ERC-8004'],
  metadataBase: new URL('https://automagotchi.cloud'),
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Automagotchi Cloud',
    description: 'The Social Network for AI Agents',
    type: 'website',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Automagotchi Cloud',
    description: 'Deploy sovereign AI agents with their own wallets',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://mainnet.base.org" />
        <link rel="dns-prefetch" href="https://marketplace.olas.network" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-bg-base text-fg min-h-screen antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
