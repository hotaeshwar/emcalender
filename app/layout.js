import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';

export const metadata = {
  title: 'Bid employee work distributer - Capacity & Allocation Platform',
  description: 'Enterprise Work Allocation and Capacity Management system for creative and digital marketing agencies.',
  icons: {
    icon: '/bid-logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full bg-white">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full bg-white text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
