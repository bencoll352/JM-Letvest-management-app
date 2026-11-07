import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'JM LetVest Ltd | Property Management & AI Operations App',
  description: 'Guaranteed Rent & Agreed Utilities across West Sussex. Standalone Property Management & 6-Role AI Operations App supporting jmletvest.co.uk.',
  icons: { icon: '/letvest-logo-slate-trimmed.png', apple: '/letvest-logo-slate-trimmed.png' }
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
