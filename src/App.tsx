import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SchoolProvider, useSchool } from "@/contexts/SchoolContext";
import { Layout } from "@/components/Layout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Students from "./pages/Students";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Completed from "./pages/Completed";
import Birthdays from "./pages/Birthdays";
import TrialLessons from "./pages/TrialLessons";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  const { schoolId, loading: schoolLoading } = useSchool();

  if (loading || schoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Require both authentication AND school selection
  if (!user || !schoolId) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/alunos" element={<Students />} />
        <Route path="/chamada" element={<Attendance />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/finalizados" element={<Completed />} />
        <Route path="/aniversariantes" element={<Birthdays />} />
        <Route path="/experimentais" element={<TrialLessons />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <SchoolProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </SchoolProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
