import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MobileViewProvider } from "@/contexts/MobileViewContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Cases from "@/pages/Cases";
import CaseDetail from "@/pages/CaseDetail";
import MapView from "@/pages/MapView";
import Users from "@/pages/Users";
import Teams from "@/pages/Teams";
import Persons from "@/pages/Persons";
import AdminSettings from "@/pages/AdminSettings";
import Reports from "@/pages/Reports";
import FPNReports from "@/pages/FPNReports";
import ClosedCasesMap from "@/pages/ClosedCasesMap";
import PublicReport from "@/pages/PublicReport";
import Layout from "@/components/Layout";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F2F1]">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <MobileViewProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/report" element={<PublicReport />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="cases" element={<Cases />} />
              <Route path="cases/:caseId" element={<CaseDetail />} />
              <Route path="map" element={<MapView />} />
              <Route path="users" element={
                <ProtectedRoute allowedRoles={["manager"]}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="teams" element={
                <ProtectedRoute allowedRoles={["manager"]}>
                  <Teams />
                </ProtectedRoute>
              } />
              <Route path="persons" element={
                <ProtectedRoute allowedRoles={["manager", "supervisor"]}>
                  <Persons />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={["manager"]}>
                  <AdminSettings />
                </ProtectedRoute>
              } />
              <Route path="reports" element={
                <ProtectedRoute allowedRoles={["manager", "supervisor"]}>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="fpn-reports" element={
                <ProtectedRoute allowedRoles={["manager", "supervisor"]}>
                  <FPNReports />
                </ProtectedRoute>
              } />
              <Route path="closed-cases-map" element={
                <ProtectedRoute allowedRoles={["manager", "supervisor"]}>
                  <ClosedCasesMap />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </MobileViewProvider>
    </AuthProvider>
  );
}

export default App;
