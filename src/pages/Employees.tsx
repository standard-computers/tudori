import { useEffect, useState, useRef } from "react";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortableTableHead } from "@/components/SortableTableHead";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, User, Eye, Link2, Maximize2, Minimize2, UserPlus } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Badge } from "@/components/ui/badge";
import { toast } from '@/lib/toast';
import { TimesheetsTab } from "@/components/employees/TimesheetsTab";

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  status: string;
  notes: string | null;
  wage: number | null;
  is_hourly: boolean;
  bonus_eligible: boolean;
  user_id: string | null;
}

interface UserProfile {
  user_id: string;
  email: string | null;
  first_name: string;
  last_name: string;
}

interface Team {
  id: string;
  name: string;
}

const STATUSES = ["active", "inactive", "on_leave"];

// Column definitions for Employees table
const EMPLOYEE_COLUMNS: ColumnDefinition[] = [
  { key: "employee_id", label: "ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "phone", label: "Phone", defaultVisible: true },
  { key: "job_title", label: "Job Title", defaultVisible: true },
  { key: "department", label: "Department", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "wage", label: "Wage", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

const EmployeeTable = ({
  employees,
  onView,
  onEdit,
}: {
  employees: Employee[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}) => {
  const { sortConfig, filters, handleSort, setFilter, clearAllFilters, sortedAndFilteredData } = useTableSort(
    employees,
    "employee_id",
    "asc",
  );

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {employees.length} employees
          </span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
          {Object.entries(filters).map(
            ([key, value]) =>
              value && (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {value}
                  <button onClick={() => setFilter(key, "")} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ),
          )}
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                label="ID"
                sortKey="employee_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["employee_id"]}
                onFilter={(value) => setFilter("employee_id", value)}
                className="w-24"
              />
              <SortableTableHead
                label="Name"
                sortKey="last_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["last_name"]}
                onFilter={(value) => setFilter("last_name", value)}
              />
              <SortableTableHead
                label="Email"
                sortKey="email"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["email"]}
                onFilter={(value) => setFilter("email", value)}
              />
              <SortableTableHead
                label="Job Title"
                sortKey="job_title"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["job_title"]}
                onFilter={(value) => setFilter("job_title", value)}
              />
              <SortableTableHead
                label="Team"
                sortKey="department"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["department"]}
                onFilter={(value) => setFilter("department", value)}
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["status"]}
                onFilter={(value) => setFilter("status", value)}
                className="w-24"
              />
              <SortableTableHead
                label="Actions"
                sortKey=""
                currentSortKey=""
                currentSortDirection="asc"
                onSort={() => {}}
                className="w-24 text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <button
                    className="font-mono text-xs text-primary underline-offset-4 hover:underline cursor-pointer"
                    onClick={() => onView(employee)}
                  >
                    {employee.employee_id}
                  </button>
                </TableCell>
                <TableCell className="font-medium">
                  {employee.first_name} {employee.last_name}
                </TableCell>
                <TableCell>{employee.email || "-"}</TableCell>
                <TableCell>{employee.job_title || "-"}</TableCell>
                <TableCell>{employee.department || "-"}</TableCell>
                <TableCell>
                  <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(employee)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(employee)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedAndFilteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No employees found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const Employees = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextEmployeeId, setNextEmployeeId] = useState("0001");
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isViewMaximized, setIsViewMaximized] = useState(false);
  const [isFormMaximized, setIsFormMaximized] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'viewer' | 'it'>('member');

  const [formData, setFormData] = useState({
    employee_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    job_title: "",
    department: "",
    hire_date: "",
    status: "active",
    notes: "",
    wage: "",
    is_hourly: false,
    bonus_eligible: false,
    user_id: "",
  });

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? "emp/edit" : "emp/new");
    } else {
      setTransaction("emp");
    }
  }, [isDialogOpen, isEditing, setTransaction]);

  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchEmployees();
      fetchNextEmployeeId();
      fetchUsers();
      fetchTeams();
    }
  }, [companyId]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .eq("company_id", companyId)
      .order("last_name");

    setUsers(data || []);
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name").eq("company_id", companyId).order("name");

    setTeams(data || []);
  };

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", companyId)
      .order("employee_id");

    if (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
      return;
    }

    setEmployees(data || []);
  };

  const fetchNextEmployeeId = async () => {
    const { data } = await supabase.rpc("get_next_employee_id", {
      p_company_id: companyId,
    });
    if (data) {
      setNextEmployeeId(data);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      employee_id: nextEmployeeId,
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      job_title: "",
      department: "",
      hire_date: "",
      status: "active",
      notes: "",
      wage: "",
      is_hourly: false,
      bonus_eligible: false,
      user_id: "",
    });
    setIsEditing(false);
    setEditingId(null);
    setCreateUserAccount(false);
    setUserRole('member');
    setIsDialogOpen(true);
  };

  useKeyboardShortcut("n", handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleEdit = (employee: Employee) => {
    setFormData({
      employee_id: employee.employee_id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email || "",
      phone: employee.phone || "",
      job_title: employee.job_title || "",
      department: employee.department || "",
      hire_date: employee.hire_date || "",
      status: employee.status,
      notes: employee.notes || "",
      wage: employee.wage?.toString() || "",
      is_hourly: employee.is_hourly || false,
      bonus_eligible: employee.bonus_eligible || false,
      user_id: employee.user_id || "",
    });
    setIsEditing(true);
    setEditingId(employee.id);
    setCreateUserAccount(false);
    setUserRole('member');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete employee");
      return;
    }
    toast.success("Employee deleted");
    fetchEmployees();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      toast.error("First and last name are required");
      return;
    }
    if (createUserAccount && !formData.email) {
      toast.error("Email is required to create a user account");
      return;
    }

    setIsSubmitting(true);

    try {
      const employeeData = {
        company_id: companyId!,
        employee_id: formData.employee_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        job_title: formData.job_title || null,
        department: formData.department || null,
        hire_date: formData.hire_date || null,
        status: formData.status,
        notes: formData.notes || null,
        wage: formData.wage ? parseFloat(formData.wage) : null,
        is_hourly: formData.is_hourly,
        bonus_eligible: formData.bonus_eligible,
        user_id: formData.user_id || null,
      };

      let employeeId = editingId;

      if (isEditing && editingId) {
        const { error } = await supabase.from("employees").update(employeeData).eq("id", editingId);
        if (error) throw error;
        toast.success("Employee updated");
      } else {
        const { data, error } = await supabase.from("employees").insert(employeeData).select("id").single();
        if (error) throw error;
        employeeId = data.id;
        toast.success("Employee created");
      }

      // Sync team membership based on department (team name)
      if (employeeId) {
        // Remove from all teams first
        await supabase.from("team_members").delete().eq("employee_id", employeeId);

        // If a team is selected, add to that team
        if (formData.department) {
          const team = teams.find((t) => t.name === formData.department);
          if (team) {
            await supabase.from("team_members").insert({
              team_id: team.id,
              employee_id: employeeId,
              role: "member",
            });
          }
        }
      }

      // Create user invitation if requested
      if (createUserAccount && formData.email && !formData.user_id) {
        try {
          const { error: inviteError } = await supabase.from("invitations").insert({
            email: formData.email.toLowerCase(),
            company_id: companyId!,
            role: userRole,
            invited_by: user!.id,
          });
          if (inviteError) {
            if (inviteError.code === '23505') {
              toast.error("This email already has a pending invitation");
            } else {
              console.error("Invitation error:", inviteError);
              toast.error("Employee saved but invitation failed to send");
            }
          } else {
            toast.success(`Invitation sent to ${formData.email}`);
          }
        } catch (invErr) {
          console.error("Invitation error:", invErr);
        }
      }

      setIsDialogOpen(false);
      setCreateUserAccount(false);
      setUserRole('member');
      fetchEmployees();
      fetchNextEmployeeId();
    } catch (error: any) {
      toast.error(error.message || "Failed to save employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <User className="h-6 w-6 text-blue-500" />
              <h1 className="text-xl font-semibold">Employees</h1>
            </div>
          </div>
          <Button onClick={handleOpenDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Employee
            <Kbd className="ml-2">N</Kbd>
          </Button>
        </div>
      </header>

      <main className="p-0">
        <EmployeeTable employees={employees} onView={setViewingEmployee} onEdit={handleEdit} />
      </main>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setIsFormMaximized(false); }}>
        <DialogContent className={isFormMaximized ? "max-w-[95vw] max-h-[95vh]" : "max-w-2xl"}>
          <div className="absolute right-12 top-4 z-10">
            <button className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => setIsFormMaximized(v => !v)}>
              {isFormMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Employee" : "Create Employee"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update employee information" : "Add a new employee to your team"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="employee-form" ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Employee ID</Label>
                  <Input
                    id="employee_id"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    disabled={isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="job_title">Job Title</Label>
                  <Input
                    id="job_title"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Team</Label>
                  <Select
                    value={formData.department || "none"}
                    onValueChange={(v) => setFormData({ ...formData, department: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Assigning a team auto-adds employee to that team</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hire_date">Hire Date</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wage">Wage</Label>
                  <Input
                    id="wage"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.wage}
                    onChange={(e) => setFormData({ ...formData, wage: e.target.value })}
                    placeholder="0.00"
                  />
                  {formData.is_hourly && formData.wage && (
                    <p className="text-xs text-muted-foreground">
                      ≈ $
                      {(parseFloat(formData.wage) * 40 * 52).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      /year (40h/week)
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-6 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_hourly"
                      checked={formData.is_hourly}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_hourly: checked })}
                    />
                    <Label htmlFor="is_hourly" className="cursor-pointer">
                      Hourly
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="bonus_eligible"
                      checked={formData.bonus_eligible}
                      onCheckedChange={(checked) => setFormData({ ...formData, bonus_eligible: checked })}
                    />
                    <Label htmlFor="bonus_eligible" className="cursor-pointer">
                      Bonus
                    </Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_id">Linked User</Label>
                <Select
                  value={formData.user_id || "none"}
                  onValueChange={(v) => {
                    setFormData({ ...formData, user_id: v === "none" ? "" : v });
                    if (v !== "none") setCreateUserAccount(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user to link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked user</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this employee to a user account for time clock access
                </p>
              </div>
              {!formData.user_id && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="create_user"
                      checked={createUserAccount}
                      onCheckedChange={setCreateUserAccount}
                    />
                    <Label htmlFor="create_user" className="cursor-pointer flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create user account (optional)
                    </Label>
                  </div>
                  {createUserAccount && (
                    <div className="space-y-3 pl-1">
                      {!formData.email && (
                        <p className="text-sm text-destructive">
                          An email address is required to create a user account. Please fill in the email field above.
                        </p>
                      )}
                      <div className="space-y-2">
                        <Label>Access Level</Label>
                        <Select value={userRole} onValueChange={(v) => setUserRole(v as typeof userRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="it">IT</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        An invitation will be sent to the employee's email. They can sign up to access the system.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </form>
          </DialogBody>
          <DialogFooter>
            {isEditing && editingId && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  handleDelete(editingId);
                  setIsDialogOpen(false);
                }}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button type="submit" form="employee-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Update" : "Create"}
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingEmployee} onOpenChange={(open) => { if (!open) { setViewingEmployee(null); setIsViewMaximized(false); } }}>
        <DialogContent className={isViewMaximized ? "max-w-[95vw] max-h-[95vh]" : "max-w-2xl max-h-[85vh]"}>
          <div className="absolute right-12 top-4 z-10 flex items-center gap-2">
            <button
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => {
                if (viewingEmployee) {
                  handleEdit(viewingEmployee);
                  setViewingEmployee(null);
                  setIsViewMaximized(false);
                }
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => setIsViewMaximized(v => !v)}>
              {isViewMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {viewingEmployee?.first_name} {viewingEmployee?.last_name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              Employee ID: {viewingEmployee?.employee_id}
              {viewingEmployee?.user_id && (
                <Badge variant="outline" className="ml-2">
                  <Link2 className="h-3 w-3 mr-1" />
                  Linked to User
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-6">
            {viewingEmployee && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant={viewingEmployee.status === "active" ? "default" : "secondary"}>
                        {viewingEmployee.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Team</p>
                      <p className="font-medium">{viewingEmployee.department || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Job Title</p>
                      <p className="font-medium">{viewingEmployee.job_title || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hire Date</p>
                      <p className="font-medium">{viewingEmployee.hire_date || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{viewingEmployee.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{viewingEmployee.phone || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Wage</p>
                      <p className="font-medium">
                        {viewingEmployee.wage
                          ? `$${viewingEmployee.wage.toLocaleString("en-US", { minimumFractionDigits: 2 })}${viewingEmployee.is_hourly ? "/hr" : ""}`
                          : "-"}
                      </p>
                      {viewingEmployee.is_hourly && viewingEmployee.wage && (
                        <p className="text-xs text-muted-foreground">
                          ≈ $
                          {(viewingEmployee.wage * 40 * 52).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          /year
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Compensation</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={viewingEmployee.is_hourly ? "default" : "secondary"}>
                          {viewingEmployee.is_hourly ? "Hourly" : "Salary"}
                        </Badge>
                        {viewingEmployee.bonus_eligible && <Badge variant="outline">Bonus Eligible</Badge>}
                      </div>
                    </div>
                  </div>
                  {viewingEmployee.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{viewingEmployee.notes}</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="timesheets" className="mt-4">
                  <TimesheetsTab employeeId={viewingEmployee.id} />
                </TabsContent>
              </Tabs>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
