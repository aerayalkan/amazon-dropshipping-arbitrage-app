import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Amazon Dropshipping Arbitrage Dashboard',
  description: 'Advanced AI-powered analytics and management interface for Amazon dropshipping arbitrage operations',
  keywords: [
    'amazon',
    'dropshipping', 
    'arbitrage',
    'ai',
    'analytics',
    'dashboard',
    'e-commerce',
    'machine learning'
  ],
  authors: [{ name: 'Ahmet Eray Alkan' }],
  creator: 'Ahmet Eray Alkan',
  publisher: 'Amazon Dropshipping Solutions',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://yoursite.com',
    siteName: 'Amazon Dropshipping Dashboard',
    title: 'Amazon Dropshipping Arbitrage Dashboard',
    description: 'Advanced AI-powered analytics and management interface for Amazon dropshipping arbitrage operations',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Amazon Dropshipping Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amazon Dropshipping Arbitrage Dashboard',
    description: 'Advanced AI-powered analytics and management interface for Amazon dropshipping arbitrage operations',
    images: ['/og-image.png'],
    creator: '@yourusername',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}