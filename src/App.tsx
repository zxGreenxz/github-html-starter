import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrintQueueProvider } from "@/contexts/PrintQueueContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PurchaseOrders from "./pages/PurchaseOrders";
import Products from "./pages/Products";
import LiveProducts from "./pages/LiveProducts";
import GoodsReceiving from "./pages/GoodsReceiving";
import SearchProducts from "./pages/SearchProducts";
import Settings from "./pages/Settings";
import ActivityLog from "./pages/ActivityLog";
import Customers from "./pages/Customers";

import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import RealtimeProvider from "@/components/RealtimeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RealtimeProvider />
    <BrowserRouter>
      <AuthProvider>
        <PrintQueueProvider>
          <TooltipProvider>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseOrders />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/purchase-orders" element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseOrders />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/products" element={
                <ProtectedRoute>
                  <Layout>
                    <Products />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/live-products" element={
                <ProtectedRoute>
                  <Layout>
                    <LiveProducts />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/goods-receiving" element={
                <ProtectedRoute>
                  <Layout>
                    <GoodsReceiving />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/search-products" element={
                <ProtectedRoute>
                  <Layout>
                    <SearchProducts />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/activity-log" element={
                <ProtectedRoute>
                  <Layout>
                    <ActivityLog />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/customers" element={
                <ProtectedRoute>
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
              <Sonner />
              </TooltipProvider>
        </PrintQueueProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;