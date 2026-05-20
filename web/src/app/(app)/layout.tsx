import { AppNav } from '@/components/app-nav';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">{children}</main>
    </div>
  );
}
