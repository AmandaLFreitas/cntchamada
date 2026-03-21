import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BirthdayNotification } from '@/components/BirthdayNotification';
import logoImg from '@/assets/logo-cnt.png';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="CNT Informática" className="h-8 w-8 rounded-full" />
              <span className="font-bold text-primary text-sm hidden sm:inline">CNT Informática</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
        <BirthdayNotification />
      </div>
    </SidebarProvider>
  );
}
