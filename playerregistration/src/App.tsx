import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import UserDashboard from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import Players from "./pages/Players";
import Test from "./pages/Test";
import Guestplayer from "./pages/Guestplayer";
import PlayerAdminView from "./pages/PlayerAdminView";
import AllPosts from "@/pages/AllPosts";
import PostCreateEdit from "@/pages/PostCreateEdit";
import PublicRoute from "@/routes/PublicRoute";
import Settings from "@/pages/Settings";
import Logs from "@/pages/Logs";

const queryClient = new QueryClient();

// Redirects with a "permission denied" message
const DeniedRedirect = ({ to, message }: { to: string; message: string }) => {
  useEffect(() => {
    // Fixed id: StrictMode runs effects twice in dev; show the toast once
    toast.error(message, { id: "permission-denied" });
  }, [message]);
  return <Navigate to={to} replace />;
};

/**
 * Admin-only page. Signed-out users go to /signin; other users go to
 * /dashboard, or to deniedRedirectTo with deniedMessage shown.
 * (UI only — the API enforces roles itself.)
 */
const AdminRoute = ({
  children,
  deniedRedirectTo,
  deniedMessage,
}: {
  children: React.ReactNode;
  deniedRedirectTo?: string;
  deniedMessage?: string;
}) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  if (user.role !== "admin") {
    if (deniedRedirectTo) {
      return (
        <DeniedRedirect to={deniedRedirectTo} message={deniedMessage ?? "Permission denied."} />
      );
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppContent = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1">
      <Routes>
        {/* Signed-in users are sent home from these */}
        <Route
          path="/signin"
          element={
            <PublicRoute redirectTo="/">
              <SignIn />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute redirectTo="/">
              <SignUp />
            </PublicRoute>
          }
        />

        <Route path="/" element={<Home />} />
        <Route path="/players" element={<Players />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/test" element={<Test />} />
        <Route path="/player" element={<Guestplayer />} />

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/allPlayers" element={<AdminRoute><PlayerAdminView /></AdminRoute>} />
        <Route path="/allPosts" element={<AdminRoute><AllPosts /></AdminRoute>} />
        <Route path="/posts/new" element={<AdminRoute><PostCreateEdit /></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route
          path="/logs"
          element={
            <AdminRoute
              deniedRedirectTo="/"
              deniedMessage="Permission denied: only admins can view the activity logs."
            >
              <Logs />
            </AdminRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <Footer />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
