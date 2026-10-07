import { useEffect, useState, useRef } from "react";
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { EMPLOYEE_COLUMNS } from "@/config/column-layouts";
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
import { AuditHistoryTab } from "@/components/AuditHistoryTab";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { useExcel } from "@/hooks/use-excel";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";
import { CreatedPasswordDialog } from "@/pages/Users";

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  position_name?: string | null;
  department: string | null;
  hire_date: string | null;
  status: string;
  notes: string | null;
  wage: number | null;
  is_hourly: boolean;
  bonus_eligible: boolean;
  user_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  social_id: string | null;
  gender: string | null;
  ethnicity: string | null;
}

interface UserProfile {
  user_id: string;
  profile_id: string | null;
  email: string | null;
  first_name: string;
  last_name: string;
}

interface Team {
  id: string;
  name: string;
}

const STATUSES = ["active", "inactive", "on_leave", "pip", "terminated"];

const EmployeeTable = ({
  employees,
  users,
  onView,
  onEdit,
}: {
  employees: Employee[];
  users: UserProfile[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}) => {
  const { sortConfig, filters, handleSort, setFilter, clearAllFilters, sortedAndFilteredData } = useTableSort(
    employees,
    "employee_id",
    "asc",
  );
  const {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    resetToDefaults,
    showAll,
    hideAll,
  } = useColumnVisibility("employees", EMPLOYEE_COLUMNS);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleColumnCount = EMPLOYEE_COLUMNS.filter((c) => c.alwaysVisible || isColumnVisible(c.key)).length;
  const userIdFor = (employee: Employee) =>
    employee.user_id ? users.find((u) => u.user_id === employee.user_id)?.profile_id || "—" : "—";

  return (
    <div className="space-y-2">
      <div className="flex justify-end px-1">
        <ColumnToggle
          columns={EMPLOYEE_COLUMNS}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          onResetToDefaults={resetToDefaults}
          onShowAll={showAll}
          onHideAll={hideAll}
        />
      </div>
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
              {isColumnVisible("employee_id") && (
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
              )}
              {isColumnVisible("first_name") && (
              <SortableTableHead
                label="First Name"
                sortKey="first_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["first_name"]}
                onFilter={(value) => setFilter("first_name", value)}
              />
              )}
              {isColumnVisible("last_name") && (
              <SortableTableHead
                label="Last Name"
                sortKey="last_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["last_name"]}
                onFilter={(value) => setFilter("last_name", value)}
              />
              )}
              {isColumnVisible("email") && (
              <SortableTableHead
                label="Email"
                sortKey="email"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["email"]}
                onFilter={(value) => setFilter("email", value)}
              />
              )}
              {isColumnVisible("department") && (
              <SortableTableHead
                label="Team"
                sortKey="department"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["department"]}
                onFilter={(value) => setFilter("department", value)}
              />
              )}
              {isColumnVisible("job_title") && (
              <SortableTableHead
                label="Job Title"
                sortKey="job_title"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["job_title"]}
                onFilter={(value) => setFilter("job_title", value)}
              />
              )}
              {isColumnVisible("user_id") && (
              <SortableTableHead
                label="User ID"
                sortKey="user_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["user_id"]}
                onFilter={(value) => setFilter("user_id", value)}
                className="w-28"
              />
              )}
              {isColumnVisible("status") && (
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
              )}
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
                {isColumnVisible("employee_id") && (
                <TableCell>
                  <button
                    className="font-mono text-xs text-primary underline-offset-4 hover:underline cursor-pointer"
                    onClick={() => onView(employee)}
                  >
                    {employee.employee_id}
                  </button>
                </TableCell>
                )}
                {isColumnVisible("first_name") && (
                <TableCell className="font-medium">{employee.first_name}</TableCell>
                )}
                {isColumnVisible("last_name") && (
                <TableCell className="font-medium">{employee.last_name}</TableCell>
                )}
                {isColumnVisible("email") && (
                <TableCell>{employee.email || "-"}</TableCell>
                )}
                {isColumnVisible("department") && (
                <TableCell>{employee.department || "-"}</TableCell>
                )}
                {isColumnVisible("job_title") && (
                <TableCell>{employee.position_name || employee.job_title || "-"}</TableCell>
                )}
                {isColumnVisible("user_id") && (
                <TableCell className="font-mono text-xs">{userIdFor(employee)}</TableCell>
                )}
                {isColumnVisible("status") && (
                <TableCell>
                  <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge>
                </TableCell>
                )}
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
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
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
  const [isViewMaximized, setIsViewMaximized] = useMaximizedState();
  const [isFormMaximized, setIsFormMaximized] = useMaximizedState();
  const [teams, setTeams] = useState<Team[]>([]);
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'viewer' | 'it'>('member');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [createdPasswordEmail, setCreatedPasswordEmail] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState('');

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

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
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    social_id: "",
    gender: "",
    ethnicity: "",
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
      .select("user_id, profile_id, email, first_name, last_name")
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
    const SAFE_COLS = "id, company_id, employee_id, first_name, last_name, email, phone, job_title, department, hire_date, status, notes, created_at, updated_at, is_hourly, bonus_eligible, user_id, address_line1, address_line2, city, state, postal_code, country, positions(name)";
    const { data, error } = await supabase
      .from("employees")
      .select(SAFE_COLS)
      .eq("company_id", companyId)
      .order("employee_id");

    if (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
      return;
    }

    // Sensitive fields (social_id, wage, gender, ethnicity) require admin access
    let sensitiveById: Record<string, any> = {};
    const { data: sensitive } = await supabase.rpc("list_employee_sensitive", {
      p_company_id: companyId,
    });
    if (Array.isArray(sensitive)) {
      sensitiveById = Object.fromEntries(sensitive.map((s: any) => [s.id, s]));
    }

    const mapped = (data || []).map((e: any) => ({
      ...e,
      ...(sensitiveById[e.id] || {}),
      position_name: Array.isArray(e.positions) && e.positions.length > 0 ? e.positions[0].name : null,
    }));
    setEmployees(mapped);
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
      hire_date: new Date().toISOString().slice(0, 10),
      status: "active",
      notes: "",
      wage: "",
      is_hourly: false,
      bonus_eligible: false,
      user_id: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "",
      social_id: "",
      gender: "",
      ethnicity: "",
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
      address_line1: employee.address_line1 || "",
      address_line2: employee.address_line2 || "",
      city: employee.city || "",
      state: employee.state || "",
      postal_code: employee.postal_code || "",
      country: employee.country || "",
      social_id: (employee as any).social_id || "",
      gender: (employee as any).gender || "",
      ethnicity: (employee as any).ethnicity || "",
    });
    setIsEditing(true);
    setEditingId(employee.id);
    setCreateUserAccount(false);
    setUserRole('member');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Block deletion while the employee has an open time punch (clocked in)
    const { data: activePunches, error: punchError } = await supabase
      .from("time_punches")
      .select("id")
      .eq("employee_id", id)
      .is("punch_out", null)
      .limit(1);
    if (punchError) {
      toast.error("Could not verify clock status; deletion cancelled");
      return;
    }
    if (activePunches && activePunches.length > 0) {
      toast.error("Employee is currently clocked in and cannot be deleted");
      return;
    }

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
      // Non-sensitive columns only – sensitive fields go through upsert_employee_sensitive RPC
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
        is_hourly: formData.is_hourly,
        bonus_eligible: formData.bonus_eligible,
        user_id: formData.user_id || null,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        country: formData.country || null,
      };

      let employeeId = editingId;

      if (isEditing && editingId) {
        // company_id is not updatable (column-level grant) — omit it on edit
        const { company_id: _omit, ...updateData } = employeeData;
        const { error } = await supabase.from("employees").update(updateData).eq("id", editingId);
        if (error) throw error;
        toast.success("Employee updated");
      } else {
        const { data, error } = await supabase.from("employees").insert(employeeData).select("id").single();
        if (error) throw error;
        employeeId = data.id;
        toast.success("Employee created");
      }

      // Persist sensitive fields via admin/self-only RPC
      if (employeeId) {
        const { error: sensErr } = await supabase.rpc('upsert_employee_sensitive', {
          p_employee_id: employeeId,
          p_social_id: formData.social_id || null,
          p_wage: formData.wage ? parseFloat(formData.wage) : null,
          p_gender: formData.gender || null,
          p_ethnicity: formData.ethnicity || null,
        });
        if (sensErr) {
          console.warn('Sensitive employee fields not saved:', sensErr.message);
        }
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

      // Create the user account directly if requested
      if (createUserAccount && formData.email && !formData.user_id && employeeId) {
        try {
          const email = formData.email.toLowerCase().trim();
          // Clear any stale, unaccepted invitation so the new account gets a fresh record
          await supabase
            .from("invitations")
            .delete()
            .eq("company_id", companyId!)
            .eq("email", email)
            .is("accepted_at", null);

          const { data, error: fnError } = await supabase.functions.invoke("create-invited-user", {
            body: {
              email,
              role: userRole,
              company_id: companyId,
              first_name: formData.first_name.trim(),
              last_name: formData.last_name.trim(),
              send_invite: false,
            },
          });
          let errMsg: string | null = data?.error || null;
          if (fnError && !errMsg) {
            try {
              const body = await (fnError as any).context?.json?.();
              errMsg = body?.error || fnError.message;
            } catch {
              errMsg = fnError.message;
            }
          }
          if (errMsg) {
            toast.error(`Employee saved but user was not created: ${errMsg}`);
          } else if (data?.user_id) {
            await supabase.from("employees").update({ user_id: data.user_id }).eq("id", employeeId);
            toast.success(`User created for ${email}`);
            setCreatedPasswordEmail(email);
            setCreatedTempPassword(data.temp_password);
            setShowPasswordDialog(true);
          }
        } catch (err: any) {
          console.error("Create user error:", err);
          toast.error(`Employee saved but user was not created: ${err.message}`);
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

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'employees_template.xlsx', 'Employees', [
      { header: 'First Name', key: 'First Name', width: 15 },
      { header: 'Last Name', key: 'Last Name', width: 15 },
      { header: 'Email', key: 'Email', width: 25 },
      { header: 'Phone', key: 'Phone', width: 15 },
      { header: 'Job Title', key: 'Job Title', width: 20 },
      { header: 'Team', key: 'Team', width: 15 },
      { header: 'Status', key: 'Status', width: 12 },
      { header: 'Wage', key: 'Wage', width: 12 },
      { header: 'Hourly', key: 'Hourly', width: 8 },
      { header: 'Hire Date', key: 'Hire Date', width: 12 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExportEmployees = () => {
    const exportData = employees.map(e => ({
      'Employee ID': e.employee_id,
      'First Name': e.first_name,
      'Last Name': e.last_name,
      'Email': e.email || '',
      'Phone': e.phone || '',
      'Job Title': e.job_title || '',
      'Team': e.department || '',
      'Status': e.status,
      'Wage': e.wage ?? '',
      'Hourly': e.is_hourly ? 'Yes' : 'No',
      'Hire Date': e.hire_date || '',
      'Notes': e.notes || '',
    }));
    exportToExcel(exportData, 'employees.xlsx', 'Employees');
  };

  const handleImportEmployees = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) { toast.error('No data found in file'); return; }

      setImportResults([]); setImportTotal(rows.length); setImportProcessed(0);
      setIsImportComplete(false); setIsImportDialogOpen(true);
      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]; const rowNum = i + 2;
        try {
          const firstName = row['First Name']?.toString().trim();
          const lastName = row['Last Name']?.toString().trim();
          if (!firstName || !lastName) { results.push({ row: rowNum, status: 'error', message: 'First and Last Name are required' }); setImportResults([...results]); setImportProcessed(i + 1); continue; }

          const teamName = row['Team']?.toString().trim() || null;
          const status = row['Status']?.toString().trim().toLowerCase() || 'active';
          const wage = row['Wage'] ? Number(row['Wage']) : null;
          const isHourly = ['yes','true','1'].includes((row['Hourly']?.toString().trim() || '').toLowerCase());

          const { data: nextId } = await supabase.rpc('get_next_employee_id', { p_company_id: companyId });

          const { error: insertError } = await supabase.from('employees').insert({
            company_id: companyId,
            employee_id: nextId || `EMP-${String(i + 1).padStart(4, '0')}`,
            first_name: firstName,
            last_name: lastName,
            email: row['Email']?.toString().trim() || null,
            phone: row['Phone']?.toString().trim() || null,
            job_title: row['Job Title']?.toString().trim() || null,
            department: teamName,
            hire_date: row['Hire Date']?.toString().trim() || null,
            status: STATUSES.includes(status) ? status : 'active',
            wage,
            is_hourly: isHourly,
            notes: row['Notes']?.toString().trim() || null,
          });
          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Employee "${firstName} ${lastName}" created` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed' });
        }
        setImportResults([...results]); setImportProcessed(i + 1);
      }
      setIsImportComplete(true); fetchEmployees(); fetchNextEmployeeId();
    } catch (err: any) { toast.error(err.message || 'Failed to read file'); }
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
      <header className="bg-card/50 sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ArrowLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <div className="flex items-center gap-2">
              <User className="h-6 w-6 text-blue-500" />
              <h1 className="text-xl font-semibold">Employees</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportExportButtons
              importEnabled={isImportEnabled('employee')}
              exportEnabled={isExportEnabled('employee')}
              onImport={handleImportEmployees}
              onExport={handleExportEmployees}
              onDownloadTemplate={handleDownloadTemplate}
              entityName="Employees"
            />
            <Button onClick={handleOpenDialog} size="icon" className="relative">
              <Plus className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
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
          <form id="employee-form" ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
              <div className="px-6 pt-2">
                <TabsList>
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="job">Job</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="general" className="flex-1 overflow-y-auto mt-0">
                <div className="px-6 py-4 space-y-4">
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
                              {s === 'pip' ? 'PIP' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
                        autoFocus={!isEditing}
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
                      <Label htmlFor="hire_date">Hire Date</Label>
                      <Input
                        id="hire_date"
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="social_id">Social ID</Label>
                      <Input
                        id="social_id"
                        value={formData.social_id}
                        onChange={(e) => setFormData({ ...formData, social_id: e.target.value })}
                        placeholder="e.g. SSN"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        value={formData.gender || "none"}
                        onValueChange={(v) => setFormData({ ...formData, gender: v === "none" ? "" : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not specified</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ethnicity">Race / Ethnicity</Label>
                      <Select
                        value={formData.ethnicity || "none"}
                        onValueChange={(v) => setFormData({ ...formData, ethnicity: v === "none" ? "" : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ethnicity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not specified</SelectItem>
                          <SelectItem value="american_indian">American Indian or Alaska Native</SelectItem>
                          <SelectItem value="asian">Asian</SelectItem>
                          <SelectItem value="black">Black or African American</SelectItem>
                          <SelectItem value="hispanic">Hispanic or Latino</SelectItem>
                          <SelectItem value="native_hawaiian">Native Hawaiian or Other Pacific Islander</SelectItem>
                          <SelectItem value="white">White</SelectItem>
                          <SelectItem value="two_or_more">Two or More Races</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address_line1">Address Line 1</Label>
                      <Input
                        id="address_line1"
                        value={formData.address_line1}
                        onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_line2">Address Line 2</Label>
                      <Input
                        id="address_line2"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      />
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
                            A user account will be created on save and a one-time password will be shown.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="job" className="flex-1 overflow-y-auto mt-0">
                <div className="px-6 py-4 space-y-4">
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
                </div>
              </TabsContent>
              <TabsContent value="notes" className="flex-1 overflow-y-auto mt-0">
                <div className="px-6 py-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={6}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
          <DialogFooter>
            {isEditing && editingId && (
              <Button
                type="button"
                variant="secondary"
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
          <div className="absolute right-10 top-4 z-10 flex items-center gap-3">
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
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
                      <p className="font-medium">{viewingEmployee.position_name || viewingEmployee.job_title || "-"}</p>
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
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {viewingEmployee.address_line1 
                          ? [
                              viewingEmployee.address_line1,
                              viewingEmployee.address_line2,
                              [viewingEmployee.city, viewingEmployee.state, viewingEmployee.postal_code].filter(Boolean).join(", "),
                              viewingEmployee.country,
                            ].filter(Boolean).join("\n")
                          : "-"}
                      </p>
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
                </TabsContent>
                <TabsContent value="timesheets" className="mt-4">
                  <TimesheetsTab employeeId={viewingEmployee.id} />
                </TabsContent>
                <TabsContent value="notes" className="mt-4">
                  <p className="text-sm whitespace-pre-wrap">{viewingEmployee.notes || "No notes"}</p>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  <AuditHistoryTab tableName="employees" recordId={viewingEmployee.id} />
                </TabsContent>
              </Tabs>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <CreatedPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        email={createdPasswordEmail}
        tempPassword={createdTempPassword}
      />

      <ImportProgressDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Importing Employees"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />
    </div>
  );
};

export default Employees;
