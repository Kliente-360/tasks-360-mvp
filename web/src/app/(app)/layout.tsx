import { AppNav } from '@/components/app-nav';
import { DataProvider } from '@/lib/data-store';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DataProvider>
      <div className="min-h-screen">
        <AppNav />
        <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">{children}</main>
      </div>
    </DataProvider>
  );
}
