import { AppNav } from '@/components/app-nav';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
