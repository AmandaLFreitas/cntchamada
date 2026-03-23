import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BirthdayNotification } from '@/components/BirthdayNotification';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import logoImg from '@/assets/logo-cnt.png';

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, displayName } = useAuth();

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
            <div className="ml-auto flex items-center gap-2">
              {displayName && (
                <span className="text-sm text-muted-foreground hidden sm:inline">Olá, {displayName}</span>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
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
