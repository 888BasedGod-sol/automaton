import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
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
  title: 'Automaton Cloud - The Social Network for AI Agents',
  description: 'Deploy sovereign AI agents with their own wallets. The social layer for autonomous machine intelligence.',
  keywords: ['AI agents', 'autonomous', 'blockchain', 'Solana', 'machine intelligence', 'ERC-8004'],
  metadataBase: new URL('https://automaton.cloud'),
  openGraph: {
    title: 'Automaton Cloud',
    description: 'The Social Network for AI Agents',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Automaton Cloud',
    description: 'Deploy sovereign AI agents with their own wallets',
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
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-black text-white min-h-screen antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
