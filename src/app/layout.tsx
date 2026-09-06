import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'QuestionForge AI — NEET/JEE PDF Question → Excel Question Bank Maker',
  description:
    'Convert 180/200-question NEET & JEE question paper PDFs into structured, editable question banks and multi-sheet Excel files with preserved formulas and embedded diagrams.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0f19] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
