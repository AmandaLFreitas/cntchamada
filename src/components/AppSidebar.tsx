import { LayoutDashboard, Users, ClipboardList, BarChart3, CheckCircle, Cake, FlaskConical, AlertTriangle, GraduationCap, LifeBuoy, AlertOctagon, PhoneOff } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import logoImg from '@/assets/logo-cnt.png';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';

const items = [
  { title: 'Visão Geral', url: '/', icon: LayoutDashboard },
  { title: 'Alunos', url: '/alunos', icon: Users },
  { title: 'Chamada', url: '/chamada', icon: ClipboardList },
  { title: 'Relatórios', url: '/relatorios', icon: BarChart3 },
  { title: 'Certificados', url: '/finalizados', icon: CheckCircle },
  { title: 'Aniversariantes', url: '/aniversariantes', icon: Cake },
  { title: 'Aulas Experimentais', url: '/experimentais', icon: FlaskConical },
  { title: 'Finalizando o Curso', url: '/finalizando', icon: AlertTriangle },
  { title: 'Resgate', url: '/resgate', icon: LifeBuoy },
  { title: 'Faltas Consecutivas', url: '/faltas-consecutivas', icon: AlertOctagon },
  { title: 'Alunos sem Telefone', url: '/sem-telefone', icon: PhoneOff },
  { title: 'Prof. Vanderlei', url: '/professor-vanderlei', icon: GraduationCap },
  { title: 'Profª Amanda - Programação', url: '/profa-amanda', icon: GraduationCap },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isProfessor } = useAuth();
  const { school } = useSchool();

  const visibleItems = (isProfessor
    ? items.filter(i => i.url === '/chamada' || i.url === '/aniversariantes')
    : items
  ).filter(i => !(i.url === '/profa-amanda' && school?.slug === 'cascavel'));

  const handleNavClick = (url: string) => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <img src={logoImg} alt="CNT Informática" className="h-10 w-10 rounded-full flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground leading-tight">CNT Informática</h1>
              <p className="text-xs text-sidebar-foreground/60">Gestão de Alunos</p>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      onClick={() => handleNavClick(item.url)}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
