import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Members from "./pages/Members";
import Schedule from "./pages/Schedule";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Payslips from "./pages/Payslips";
import Revenue from "./pages/Revenue";
import CS from "./pages/CS";
import Issues from "./pages/Issues";
import Tasks from "./pages/Tasks";
import Tools from "./pages/Tools";
import Pilots from "./pages/Pilots";
import Meetings from "./pages/Meetings";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">로딩중...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
    <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
    <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
    <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
    <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
    <Route path="/payslips" element={<ProtectedRoute><Payslips /></ProtectedRoute>} />
    <Route path="/revenue" element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
    <Route path="/cs" element={<ProtectedRoute><CS /></ProtectedRoute>} />
    <Route path="/pilots" element={<ProtectedRoute><Pilots /></ProtectedRoute>} />
    <Route path="/issues" element={<ProtectedRoute><Issues /></ProtectedRoute>} />
    <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
    <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
    <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
