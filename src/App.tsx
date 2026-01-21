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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SearchProvider>
              <StatusBarProvider>
                <GlobalSearchHandler />
                <CommandSearch />
                <div className="pb-7">
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/complete-profile" element={<CompleteProfile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/locations" element={<Locations />} />
                  <Route path="/vendors" element={<Vendors />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/requisitions" element={<Requisitions />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/rates" element={<Rates />} />
                  <Route path="/user-settings" element={<UserSettings />} />
                  <Route path="/cockpit" element={<Cockpit />} />
                  <Route path="/deliveries" element={<Deliveries />} />
                  <Route path="/ledgers" element={<Ledgers />} />
                  <Route path="/sales-orders" element={<SalesOrders />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/accounts/:id" element={<AccountDetail />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/credit-memos" element={<CreditMemos />} />
                  <Route path="/debit-memos" element={<DebitMemos />} />
                  <Route path="/goods-receipts" element={<GoodsReceipts />} />
                  <Route path="/goods-issues" element={<GoodsIssues />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/configuration" element={<Configuration />} />
                  <Route path="/tasks" element={<Tasks />} />
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
