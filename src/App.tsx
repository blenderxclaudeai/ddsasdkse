import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Profile from "./pages/Profile";
import Showroom from "./pages/Showroom";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import AuthCallback from "./pages/AuthCallback";
import ExtensionAuth from "./pages/ExtensionAuth";

const queryClient = new QueryClient();

// Detect if running inside a Chrome extension popup
const isExtension =
  typeof chrome !== "undefined" &&
  typeof chrome.runtime !== "undefined" &&
  !!chrome.runtime.id;

const Router = isExtension ? MemoryRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/extension" element={<ExtensionAuth />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/showroom" element={<ProtectedRoute><Showroom /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
