import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Heart,
  Loader2,
  Search,
  User,
  Users2,
  Clock,
  UserCheck,
  UserX,
  Link2,
  Maximize2,
  Minimize2,
  Mail,
  Phone,
  Plus,
  Briefcase,
  ClipboardCheck,
  Star,
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { TimesheetsTab } from '@/components/employees/TimesheetsTab';
import { toast } from 'sonner';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  status: string;
  user_id: string | null;
}

interface Position {
  id: string;
  name: string;
  team_id: string;
  open_date: string;
  wage: number | null;
  show_wage: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  team?: { name: string } | null;
}

interface ActivePunch {
  employee_id: string;
  punch_in: string;
}

interface Team {
  id: string;
  name: string;
}

const HR = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activePunches, setActivePunches] = useState<ActivePunch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'employees' | 'positions'>('employees');
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [isViewMaximized, setIsViewMaximized] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [positionForm, setPositionForm] = useState({
    name: '',
    team_id: '',
    open_date: format(new Date(), 'yyyy-MM-dd'),
    wage: '',
    show_wage: false,
  });
  const [saving, setSaving] = useState(false);
  const [assignPositionId, setAssignPositionId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, notes: '', review_date: format(new Date(), 'yyyy-MM-dd') });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [employeeReviews, setEmployeeReviews] = useState<any[]>([]);
  const [employeePosition, setEmployeePosition] = useState<Position | null>(null);

  // F1 to go back
  useKeyboardShortcut('F1', () => navigate(-1));

  useEffect(() => {
    if (user) fetchCompanyId();
  }, [user]);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();
    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchActivePunches(), fetchTeams(), fetchPositions()]);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name, email, phone, job_title, department, status, user_id')
      .eq('company_id', companyId!)
      .order('last_name');
    setEmployees(data || []);
  };

  const fetchActivePunches = async () => {
    const today = new Date();
    const { data } = await supabase
      .from('time_punches')
      .select('employee_id, punch_in')
      .eq('company_id', companyId!)
      .is('punch_out', null)
      .gte('punch_in', startOfDay(today).toISOString())
      .lte('punch_in', endOfDay(today).toISOString());
    setActivePunches(data || []);
  };

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('company_id', companyId!)
      .order('name');
    setTeams(data || []);
  };

  const fetchPositions = async () => {
    const { data } = await supabase
      .from('positions')
      .select('*, team:teams(name)')
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false });
    setPositions((data as any) || []);
  };

  const handleCreatePosition = async () => {
    if (!positionForm.name || !positionForm.team_id || !companyId) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('positions').insert({
      company_id: companyId,
      name: positionForm.name,
      team_id: positionForm.team_id,
      open_date: positionForm.open_date,
      wage: positionForm.wage ? parseFloat(positionForm.wage) : null,
      show_wage: positionForm.show_wage,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to create position');
      console.error(error);
    } else {
      toast.success('Position created');
      setShowPositionDialog(false);
      setPositionForm({ name: '', team_id: '', open_date: format(new Date(), 'yyyy-MM-dd'), wage: '', show_wage: false });
      fetchPositions();
    }
  };

  const openEmployeeView = async (employee: Employee) => {
    setViewingEmployee(employee);
    setAssignPositionId('');
    setReviewForm({ rating: 0, notes: '', review_date: format(new Date(), 'yyyy-MM-dd') });
    // Fetch current position assignment
    const { data: pos } = await supabase
      .from('positions')
      .select('*, team:teams(name)')
      .eq('company_id', companyId!)
      .eq('employee_id', employee.id)
      .maybeSingle();
    setEmployeePosition((pos as any) || null);
    // Fetch reviews
    const { data: revs } = await supabase
      .from('employee_reviews')
      .select('*')
      .eq('employee_id', employee.id)
      .order('review_date', { ascending: false });
    setEmployeeReviews(revs || []);
  };

  const handleAssignPosition = async () => {
    if (!assignPositionId || !viewingEmployee || !companyId) return;
    setAssignSaving(true);
    const { error } = await supabase
      .from('positions')
      .update({ employee_id: viewingEmployee.id, status: 'filled' })
      .eq('id', assignPositionId);
    setAssignSaving(false);
    if (error) {
      toast.error('Failed to assign position');
    } else {
      toast.success('Employee assigned to position');
      setAssignPositionId('');
      fetchPositions();
      // Refresh employee position
      const { data: pos } = await supabase
        .from('positions')
        .select('*, team:teams(name)')
        .eq('company_id', companyId)
        .eq('employee_id', viewingEmployee.id)
        .maybeSingle();
      setEmployeePosition((pos as any) || null);
    }
  };

  const handleSubmitReview = async () => {
    if (!viewingEmployee || !companyId || reviewForm.rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    setReviewSaving(true);
    const { error } = await supabase.from('employee_reviews').insert({
      company_id: companyId,
      employee_id: viewingEmployee.id,
      reviewer_id: user!.id,
      review_date: reviewForm.review_date,
      rating: reviewForm.rating,
      notes: reviewForm.notes || null,
      status: 'completed',
    });
    setReviewSaving(false);
    if (error) {
      toast.error('Failed to save review');
    } else {
      toast.success('Review saved');
      setReviewForm({ rating: 0, notes: '', review_date: format(new Date(), 'yyyy-MM-dd') });
      const { data: revs } = await supabase
        .from('employee_reviews')
        .select('*')
        .eq('employee_id', viewingEmployee.id)
        .order('review_date', { ascending: false });
      setEmployeeReviews(revs || []);
    }
  };

  const openPositions = positions.filter(p => p.status === 'open');

  const activeCount = employees.filter(e => e.status === 'active').length;
  const inactiveCount = employees.filter(e => e.status !== 'active').length;
  const clockedInCount = activePunches.length;
  const clockedInEmployeeIds = new Set(activePunches.map(p => p.employee_id));

  const filteredEmployees = employees.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q) ||
      (e.email?.toLowerCase().includes(q)) ||
      (e.job_title?.toLowerCase().includes(q)) ||
      (e.department?.toLowerCase().includes(q))
    );
  });

  const filteredPositions = positions.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.team?.name?.toLowerCase().includes(q)) ||
      p.status.toLowerCase().includes(q)
    );
  });

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
              <Heart className="h-6 w-6 text-rose-500" />
              <h1 className="text-xl font-semibold">HR</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
              <User className="h-4 w-4 mr-2" />
              Employees
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/teams')}>
              <Users2 className="h-4 w-4 mr-2" />
              Teams
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/time-clock')}>
              <Clock className="h-4 w-4 mr-2" />
              Time Clock
            </Button>
            <Button size="sm" onClick={() => setShowPositionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Position
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold">{employees.length}</p>
                </div>
                <User className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{activeCount}</p>
                </div>
                <UserCheck className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                </div>
                <UserX className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Open Positions</p>
                  <p className="text-2xl font-bold">{positions.filter(p => p.status === 'open').length}</p>
                </div>
                <Plus className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Directory */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md overflow-hidden h-9">
              <button
                className={`px-3 h-full text-sm font-medium transition-colors ${directoryTab === 'employees' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setDirectoryTab('employees'); setSearchQuery(''); }}
              >
                Employees
              </button>
              <button
                className={`px-3 h-full text-sm font-medium transition-colors ${directoryTab === 'positions' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setDirectoryTab('positions'); setSearchQuery(''); }}
              >
                Positions
              </button>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={directoryTab === 'employees' ? 'Search employees...' : 'Search positions...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {directoryTab === 'employees'
                ? `${filteredEmployees.length} employee${filteredEmployees.length !== 1 ? 's' : ''}`
                : `${filteredPositions.length} position${filteredPositions.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {directoryTab === 'employees' ? (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium w-24">ID</TableCell>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell className="font-medium">Job Title</TableCell>
                    <TableCell className="font-medium">Team</TableCell>
                    <TableCell className="font-medium">Contact</TableCell>
                    <TableCell className="font-medium w-24">Status</TableCell>
                    <TableCell className="font-medium w-20">Clock</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const isClockedIn = clockedInEmployeeIds.has(employee.id);
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <button
                            className="font-mono text-xs text-primary underline-offset-4 hover:underline cursor-pointer"
                            onClick={() => openEmployeeView(employee)}
                          >
                            {employee.employee_id}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {employee.first_name} {employee.last_name}
                        </TableCell>
                        <TableCell className="text-sm">{employee.job_title || '-'}</TableCell>
                        <TableCell className="text-sm">{employee.department || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {employee.email && (
                              <a href={`mailto:${employee.email}`} className="text-muted-foreground hover:text-foreground">
                                <Mail className="h-4 w-4" />
                              </a>
                            )}
                            {employee.phone && (
                              <a href={`tel:${employee.phone}`} className="text-muted-foreground hover:text-foreground">
                                <Phone className="h-4 w-4" />
                              </a>
                            )}
                            {!employee.email && !employee.phone && <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                            {employee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isClockedIn ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                              <Clock className="h-3 w-3 mr-1" />
                              In
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No employees found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Position</TableCell>
                    <TableCell className="font-medium">Team</TableCell>
                    <TableCell className="font-medium">Open Date</TableCell>
                    <TableCell className="font-medium">Wage</TableCell>
                    <TableCell className="font-medium w-24">Status</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-medium">{position.name}</TableCell>
                      <TableCell className="text-sm">{position.team?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(position.open_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-sm">
                        {position.show_wage && position.wage != null
                          ? `$${position.wage.toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={position.status === 'open' ? 'default' : 'secondary'}>
                          {position.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPositions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No positions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* View Employee Dialog */}
      <Dialog open={!!viewingEmployee} onOpenChange={(open) => { if (!open) { setViewingEmployee(null); setIsViewMaximized(false); } }}>
        <DialogContent className={isViewMaximized ? 'max-w-[95vw] max-h-[95vh]' : 'max-w-2xl max-h-[85vh]'}>
          <div className="absolute right-12 top-4 z-10 flex items-center gap-2">
            <button
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => setIsViewMaximized(v => !v)}
            >
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
                  <TabsTrigger value="position">Position</TabsTrigger>
                  <TabsTrigger value="review">Review</TabsTrigger>
                  <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant={viewingEmployee.status === 'active' ? 'default' : 'secondary'}>
                        {viewingEmployee.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Team</p>
                      <p className="font-medium">{viewingEmployee.department || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Job Title</p>
                      <p className="font-medium">{viewingEmployee.job_title || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clock Status</p>
                      {clockedInEmployeeIds.has(viewingEmployee.id) ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          <Clock className="h-3 w-3 mr-1" />
                          Clocked In
                        </Badge>
                      ) : (
                        <p className="font-medium text-muted-foreground">Not clocked in</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      {viewingEmployee.email ? (
                        <a href={`mailto:${viewingEmployee.email}`} className="font-medium text-primary hover:underline">
                          {viewingEmployee.email}
                        </a>
                      ) : (
                        <p className="font-medium">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      {viewingEmployee.phone ? (
                        <a href={`tel:${viewingEmployee.phone}`} className="font-medium text-primary hover:underline">
                          {viewingEmployee.phone}
                        </a>
                      ) : (
                        <p className="font-medium">-</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Assign to Position Tab */}
                <TabsContent value="position" className="space-y-4 mt-4">
                  {employeePosition ? (
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1">Current Position</p>
                        <p className="font-medium">{employeePosition.name}</p>
                        <p className="text-sm text-muted-foreground">{employeePosition.team?.name || '-'}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-sm text-muted-foreground">No position currently assigned.</p>
                  )}
                  {openPositions.length > 0 ? (
                    <div className="space-y-3">
                      <Label>Assign to Open Position</Label>
                      <Select value={assignPositionId} onValueChange={setAssignPositionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a position..." />
                        </SelectTrigger>
                        <SelectContent>
                          {openPositions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} — {p.team?.name || 'No team'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAssignPosition} disabled={!assignPositionId || assignSaving} size="sm">
                        {assignSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Briefcase className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No open positions available.</p>
                  )}
                </TabsContent>

                {/* Review Tab */}
                <TabsContent value="review" className="space-y-4 mt-4">
                  <div className="space-y-3 border rounded-md p-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      New Review
                    </h4>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={reviewForm.review_date}
                        onChange={(e) => setReviewForm(f => ({ ...f, review_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rating</Label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewForm(f => ({ ...f, rating: star }))}
                            className="p-0.5"
                          >
                            <Star
                              className={`h-6 w-6 ${star <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="Performance notes..."
                        value={reviewForm.notes}
                        onChange={(e) => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <Button onClick={handleSubmitReview} disabled={reviewSaving || reviewForm.rating === 0} size="sm">
                      {reviewSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Submit Review
                    </Button>
                  </div>
                  {employeeReviews.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Past Reviews</h4>
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableCell className="font-medium">Date</TableCell>
                              <TableCell className="font-medium">Rating</TableCell>
                              <TableCell className="font-medium">Notes</TableCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employeeReviews.map((rev) => (
                              <TableRow key={rev.id}>
                                <TableCell className="text-sm">{format(parseISO(rev.review_date), 'MMM d, yyyy')}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star key={s} className={`h-3.5 w-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm max-w-[200px] truncate">{rev.notes || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
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

      {/* Create Position Dialog */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Position</DialogTitle>
            <DialogDescription>Create an open position on a team.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="position-name">Position Name *</Label>
              <Input
                id="position-name"
                placeholder="e.g. Warehouse Associate"
                value={positionForm.name}
                onChange={(e) => setPositionForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-team">Team *</Label>
              <Select
                value={positionForm.team_id}
                onValueChange={(v) => setPositionForm(f => ({ ...f, team_id: v }))}
              >
                <SelectTrigger id="position-team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-date">Open Date</Label>
              <Input
                id="position-date"
                type="date"
                value={positionForm.open_date}
                onChange={(e) => setPositionForm(f => ({ ...f, open_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-wage">Wage</Label>
              <Input
                id="position-wage"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={positionForm.wage}
                onChange={(e) => setPositionForm(f => ({ ...f, wage: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="position-show-wage">Show wage for position</Label>
              <Switch
                id="position-show-wage"
                checked={positionForm.show_wage}
                onCheckedChange={(v) => setPositionForm(f => ({ ...f, show_wage: v }))}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPositionDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePosition} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HR;
