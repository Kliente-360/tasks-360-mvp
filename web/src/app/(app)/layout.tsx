import { AppNav } from '@/components/app-nav';
import { DataProvider } from '@/lib/data-store';
import { TaskModalProvider } from '@/components/task-modal';
import { ToastProvider } from '@/components/toast';
import { HelpProvider } from '@/components/help-modal';
import { OnboardingProvider } from '@/components/onboarding-modal';
import { ThemeProvider } from '@/components/theme-toggle';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      <DataProvider>
        <ToastProvider>
          <HelpProvider>
            <OnboardingProvider>
              <TaskModalProvider>
                <div className="min-h-screen">
                  <AppNav />
                  <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">{children}</main>
                </div>
              </TaskModalProvider>
            </OnboardingProvider>
          </HelpProvider>
        </ToastProvider>
      </DataProvider>
    </ThemeProvider>
  );
}
