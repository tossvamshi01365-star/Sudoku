import type { Metadata } from 'next';
import './globals.css';
import { getBrandName } from '../lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: `${brandName} - The Billion-Dollar Sudoku Challenge`,
    description: `Join ${brandName}: solve 100 Sudoku puzzles and put yourself in contention for the $1 billion grand prize.`,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
        {children}
      </body>
    </html>
  );
}

