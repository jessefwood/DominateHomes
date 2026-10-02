import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Plan 643 Bianca PSL',
  description: 'Your project with Dominate Homes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
