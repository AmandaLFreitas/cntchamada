import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { FinalizingNotification } from '@/components/FinalizingNotification';
import { TrialLessonNotification } from '@/components/TrialLessonNotification';
import { BirthdayNotification } from '@/components/BirthdayNotification';
import { FinalizingFloatingNotification } from '@/components/FinalizingFloatingNotification';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { LogOut, Building2 } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import logoImg from '@/assets/logo-cnt.png';

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, displayName } = useAuth();
  const { schools, schoolId, setSchoolId } = useSchool();

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
              <div className="flex items-center gap-1.5 bg-muted/40 border rounded-md pl-2 pr-1 py-0.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={schoolId ?? ''} onValueChange={setSchoolId}>
                  <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-sm focus:ring-0 shadow-none w-auto min-w-[90px]">
                    <SelectValue placeholder="Unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {displayName && (
                <span className="text-sm text-muted-foreground hidden sm:inline">Olá, {displayName}</span>
              )}
              <FinalizingNotification />
              <ChangePasswordDialog />
              <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
            {children}
          </main>
          <TrialLessonNotification />
          <BirthdayNotification />
          <FinalizingFloatingNotification />
        </div>
      </div>
    </SidebarProvider>
  );
}
