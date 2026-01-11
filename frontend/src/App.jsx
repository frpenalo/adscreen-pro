import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Auth
import Login from './pages/Login';
import Register from './pages/Register';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminAds from './pages/admin/Ads';
import AdminVenues from './pages/admin/Venues';
import AdminPayouts from './pages/admin/Payouts';

// Venue
import VenueDashboard from './pages/venue/Dashboard';
import VenueEarnings from './pages/venue/Earnings';
import VenuePayouts from './pages/venue/Payouts';

// Advertiser
import AdvertiserDashboard from './pages/advertiser/Dashboard';
import AdvertiserCampaigns from './pages/advertiser/Campaigns';
import AdvertiserUpload from './pages/advertiser/Upload';
import AdvertiserLocations from './pages/advertiser/Locations';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Dashboard Router based on role
const DashboardRouter = () => {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user?.role === 'venue') {
    return <Navigate to="/venue/dashboard" replace />;
  } else if (user?.role === 'advertiser') {
    return <Navigate to="/advertiser/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

function AppContent() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Dashboard Router */}
          <Route path="/" element={<DashboardRouter />} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/ads" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminAds />
            </ProtectedRoute>
          } />
          <Route path="/admin/venues" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminVenues />
            </ProtectedRoute>
          } />
          <Route path="/admin/payouts" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPayouts />
            </ProtectedRoute>
          } />

          {/* Venue Routes */}
          <Route path="/venue/dashboard" element={
            <ProtectedRoute allowedRoles={['venue']}>
              <VenueDashboard />
            </ProtectedRoute>
          } />
          <Route path="/venue/earnings" element={
            <ProtectedRoute allowedRoles={['venue']}>
              <VenueEarnings />
            </ProtectedRoute>
          } />
          <Route path="/venue/payouts" element={
            <ProtectedRoute allowedRoles={['venue']}>
              <VenuePayouts />
            </ProtectedRoute>
          } />

          {/* Advertiser Routes */}
          <Route path="/advertiser/dashboard" element={
            <ProtectedRoute allowedRoles={['advertiser']}>
              <AdvertiserDashboard />
            </ProtectedRoute>
          } />
          <Route path="/advertiser/campaigns" element={
            <ProtectedRoute allowedRoles={['advertiser']}>
              <AdvertiserCampaigns />
            </ProtectedRoute>
          } />
          <Route path="/advertiser/upload" element={
            <ProtectedRoute allowedRoles={['advertiser']}>
              <AdvertiserUpload />
            </ProtectedRoute>
          } />
          <Route path="/advertiser/locations" element={
            <ProtectedRoute allowedRoles={['advertiser']}>
              <AdvertiserLocations />
            </ProtectedRoute>
          } />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
