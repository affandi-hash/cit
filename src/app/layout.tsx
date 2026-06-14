import type { Metadata } from 'next'
import { IBM_Plex_Sans, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'CIT — Claim Intelligence Tracker',
  description: 'Professional investigation and intelligence platform for tracking online claims.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full" style={{ background: '#081120', color: '#F1F5F9', fontFamily: 'var(--font-ibm-plex-sans), system-ui, sans-serif' }}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
