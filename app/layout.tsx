import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Allan Varghese — Full-Stack Engineer | AI & SaaS',
  description: 'Portfolio of Allan Varghese: full-stack engineering, AI-powered products, SaaS architecture, and practical software systems.',
  openGraph: { title: 'Allan Varghese — Full-Stack Engineer', description: 'Building software that connects ideas to impact.', type: 'website' }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
