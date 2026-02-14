import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { StatusBarProvider } from "@/contexts/StatusBarContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { StatusBar } from "@/components/StatusBar";
import { CommandSearch } from "@/components/CommandSearch";
import { GlobalSearchHandler } from "@/components/GlobalSearchHandler";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeSync } from "@/components/ThemeSync";
import { ScrollToTop } from "@/components/ScrollToTop";
import { usePageTitle } from "@/hooks/use-page-title";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import CompleteProfile from "./pages/CompleteProfile";
import Settings from "./pages/Settings";
import Locations from "./pages/Locations";
import Vendors from "./pages/Vendors";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Requisitions from "./pages/Requisitions";
import Orders from "./pages/Orders";
import Rates from "./pages/Rates";
import UserSettings from "./pages/UserSettings";
import Cockpit from "./pages/Cockpit";
import Deliveries from "./pages/Deliveries";
import Ledgers from "./pages/Ledgers";
import SalesOrders from "./pages/SalesOrders";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Invoices from "./pages/Invoices";
import CreditMemos from "./pages/CreditMemos";
import DebitMemos from "./pages/DebitMemos";
import GoodsReceipts from "./pages/GoodsReceipts";
import GoodsIssues from "./pages/GoodsIssues";
import Inventory from "./pages/Inventory";
import Configuration from "./pages/Configuration";
import Tasks from "./pages/Tasks";
import Employees from "./pages/Employees";
import Teams from "./pages/Teams";
import POS from "./pages/POS";
import TimeClock from "./pages/TimeClock";
import Production from "./pages/Production";
import BillOfMaterials from "./pages/BillOfMaterials";
import Planning from "./pages/Planning";
import Messages from "./pages/Messages";
import Analytics from "./pages/Analytics";
import DataExplorer from "./pages/DataExplorer";
import Transportation from "./pages/Transportation";
import Help from "./pages/Help";
import Go from "./pages/Go";
import HR from "./pages/HR";
import CalendarPage from "./pages/Calendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const PageTitle = () => { usePageTitle(); return null; };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ThemeSync />
            <ScrollToTop />
            <PageTitle />
            <SearchProvider>
              <StatusBarProvider>
                <GlobalSearchHandler />
                <CommandSearch />
                <div className="pb-7">
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/complete-profile" element={<CompleteProfile />} />
                  <Route path="/user-settings" element={<UserSettings />} />
                  {/* Protected routes - require transaction access */}
                  <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
                  <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                  <Route path="/requisitions" element={<ProtectedRoute><Requisitions /></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                  <Route path="/rates" element={<ProtectedRoute><Rates /></ProtectedRoute>} />
                  <Route path="/cockpit" element={<ProtectedRoute><Cockpit /></ProtectedRoute>} />
                  <Route path="/deliveries" element={<ProtectedRoute><Deliveries /></ProtectedRoute>} />
                  <Route path="/ledgers" element={<ProtectedRoute><Ledgers /></ProtectedRoute>} />
                  <Route path="/sales-orders" element={<ProtectedRoute><SalesOrders /></ProtectedRoute>} />
                  <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
                  <Route path="/accounts/:id" element={<ProtectedRoute><AccountDetail /></ProtectedRoute>} />
                  <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
                  <Route path="/credit-memos" element={<ProtectedRoute><CreditMemos /></ProtectedRoute>} />
                  <Route path="/debit-memos" element={<ProtectedRoute><DebitMemos /></ProtectedRoute>} />
                  <Route path="/goods-receipts" element={<ProtectedRoute><GoodsReceipts /></ProtectedRoute>} />
                  <Route path="/goods-issues" element={<ProtectedRoute><GoodsIssues /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                  <Route path="/configuration" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                  <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
                  <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
                  <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                  <Route path="/time-clock" element={<ProtectedRoute><TimeClock /></ProtectedRoute>} />
                  <Route path="/production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
                  <Route path="/bill-of-materials" element={<ProtectedRoute><BillOfMaterials /></ProtectedRoute>} />
                  <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/data-explorer" element={<ProtectedRoute><DataExplorer /></ProtectedRoute>} />
                  <Route path="/transportation" element={<ProtectedRoute><Transportation /></ProtectedRoute>} />
                  <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
                  <Route path="/go" element={<ProtectedRoute><Go /></ProtectedRoute>} />
                  <Route path="/hr" element={<ProtectedRoute><HR /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </div>
                <StatusBar />
              </StatusBarProvider>
            </SearchProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
