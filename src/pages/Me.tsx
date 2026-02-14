import { useEffect, useState, useCallback } from "react";
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Kbd } from "@/components/ui/kbd";
import { ArrowLeft, Loader2, UserCircle, Plus, Clock, Users2, CalendarOff, Save, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { format, parseISO, differenceInMinutes } from "date-fns";

interface EmployeeRecord {
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
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

interface TimePunch {
  id: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
}

interface TimeOffRequest {
  id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  hours: number | null;
  notes: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    email: string | null;
  };
  role: string;
}

interface TeamInfo {
  id: string;
  name: string;
  members: TeamMember[];
}

const REQUEST_TYPES = ["vacation", "sick", "personal", "bereavement", "jury_duty", "other"];

const Me = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Time off request form
  const [requestForm, setRequestForm] = useState({
    request_type: "vacation",
    start_date: "",
    end_date: "",
    hours: "",
    notes: "",
  });

  useEffect(() => {
    setTransaction("me");
  }, [setTransaction]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    if (!user) return;
    setLoading(true);

    // Get profile for company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setCompanyId(profile.company_id);

    // Get employee record linked to this user
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .eq("company_id", profile.company_id)
      .single();

    if (emp) {
      setEmployee(emp as EmployeeRecord);
      setProfileForm({
        phone: emp.phone || "",
        address_line1: emp.address_line1 || "",
        address_line2: emp.address_line2 || "",
        city: emp.city || "",
        state: emp.state || "",
        postal_code: emp.postal_code || "",
        country: emp.country || "",
      });
      // Fetch related data in parallel
      fetchPunches(emp.id);
      fetchTimeOffRequests(emp.id);
      fetchTeams(emp.id, profile.company_id);
    }
    setLoading(false);
  };

  const fetchPunches = async (employeeId: string) => {
    const { data } = await supabase
      .from("time_punches")
      .select("id, punch_in, punch_out, notes")
      .eq("employee_id", employeeId)
      .order("punch_in", { ascending: false })
      .limit(50);
    setPunches(data || []);
  };

  const fetchTimeOffRequests = async (employeeId: string) => {
    const { data } = await supabase
      .from("time_off_requests")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    setTimeOffRequests((data as TimeOffRequest[]) || []);
  };

  const fetchTeams = async (employeeId: string, cId: string) => {
    // Get teams this employee belongs to
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("employee_id", employeeId);

    if (!memberships || memberships.length === 0) {
      setTeams([]);
      return;
    }

    const teamIds = memberships.map((m) => m.team_id);
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);

    if (!teamData) { setTeams([]); return; }

    // Fetch members for each team
    const teamsWithMembers: TeamInfo[] = [];
    for (const team of teamData) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, role, employee:employees(id, first_name, last_name, job_title, email)")
        .eq("team_id", team.id);

      teamsWithMembers.push({
        id: team.id,
        name: team.name,
        members: (members || []) as unknown as TeamMember[],
      });
    }
    setTeams(teamsWithMembers);
  };

  const handleSaveProfile = async () => {
    if (!employee) return;
    setIsSavingProfile(true);

    const { error } = await supabase
      .from("employees")
      .update({
        phone: profileForm.phone || null,
        address_line1: profileForm.address_line1 || null,
        address_line2: profileForm.address_line2 || null,
        city: profileForm.city || null,
        state: profileForm.state || null,
        postal_code: profileForm.postal_code || null,
        country: profileForm.country || null,
      })
      .eq("id", employee.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
      fetchEmployeeData();
    }
    setIsSavingProfile(false);
  };

  const handleSubmitTimeOff = async () => {
    if (!requestForm.start_date || !requestForm.end_date) {
      toast.error("Start and end dates are required");
      return;
    }
    if (!employee || !companyId) return;
    setIsSubmitting(true);

    const { error } = await supabase.from("time_off_requests").insert({
      company_id: companyId,
      employee_id: employee.id,
      request_type: requestForm.request_type,
      start_date: requestForm.start_date,
      end_date: requestForm.end_date,
      hours: requestForm.hours ? parseFloat(requestForm.hours) : null,
      notes: requestForm.notes || null,
    });

    if (error) {
      toast.error("Failed to submit request");
    } else {
      toast.success("Time off request submitted");
      setIsRequestDialogOpen(false);
      setRequestForm({ request_type: "vacation", start_date: "", end_date: "", hours: "", notes: "" });
      fetchTimeOffRequests(employee.id);
    }
    setIsSubmitting(false);
  };

  const handleCancelRequest = async (id: string) => {
    const { error } = await supabase.from("time_off_requests").delete().eq("id", id);
    if (error) {
      toast.error("Failed to cancel request");
    } else {
      toast.success("Request cancelled");
      if (employee) fetchTimeOffRequests(employee.id);
    }
  };

  const formatDuration = (punchIn: string, punchOut: string | null) => {
    if (!punchOut) return "-";
    const minutes = differenceInMinutes(parseISO(punchOut), parseISO(punchIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "default";
      case "pending": return "secondary";
      case "denied": return "destructive";
      default: return "outline";
    }
  };

  // Keyboard shortcut: N for new time off request
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        e.preventDefault();
        setIsRequestDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Ctrl+S save in dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && isRequestDialogOpen) {
        e.preventDefault();
        handleSubmitTimeOff();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isRequestDialogOpen, requestForm, employee, companyId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card/50 sticky top-0 z-50">
          <div className="flex items-center h-16 px-4 gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <UserCircle className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Me</h1>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <UserCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No employee record linked</p>
          <p className="text-sm">Ask your administrator to link your user account to an employee record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/50 sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <UserCircle className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">
                {employee.first_name} {employee.last_name}
              </h1>
              <Badge variant="secondary" className="ml-2">{employee.employee_id}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsRequestDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Time Off Request
              <Kbd className="ml-2">N</Kbd>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-5xl mx-auto">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
            <TabsTrigger value="time-off">Time Off</TabsTrigger>
            <TabsTrigger value="team">My Team</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-4">
            <div className="space-y-6">
              {/* Read-only info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Job Title</p>
                  <p className="font-medium">{employee.job_title || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Team</p>
                  <p className="font-medium">{employee.department || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hire Date</p>
                  <p className="font-medium">{employee.hire_date || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{employee.email || "-"}</p>
                </div>
              </div>

              {/* Editable fields */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Editable Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="me-phone">Phone</Label>
                    <Input
                      id="me-phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="me-addr1">Address Line 1</Label>
                    <Input
                      id="me-addr1"
                      value={profileForm.address_line1}
                      onChange={(e) => setProfileForm({ ...profileForm, address_line1: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="me-addr2">Address Line 2</Label>
                    <Input
                      id="me-addr2"
                      value={profileForm.address_line2}
                      onChange={(e) => setProfileForm({ ...profileForm, address_line2: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="me-city">City</Label>
                    <Input
                      id="me-city"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="me-state">State</Label>
                    <Input
                      id="me-state"
                      value={profileForm.state}
                      onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="me-postal">Postal Code</Label>
                    <Input
                      id="me-postal"
                      value={profileForm.postal_code}
                      onChange={(e) => setProfileForm({ ...profileForm, postal_code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="me-country">Country</Label>
                    <Input
                      id="me-country"
                      value={profileForm.country}
                      onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Timesheets Tab */}
          <TabsContent value="timesheets" className="mt-4">
            {punches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 mb-2" />
                <p>No time punches recorded</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {punches.map((punch) => (
                    <TableRow key={punch.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(punch.punch_in), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{format(parseISO(punch.punch_in), "h:mm a")}</TableCell>
                      <TableCell>
                        {punch.punch_out ? format(parseISO(punch.punch_out), "h:mm a") : "-"}
                      </TableCell>
                      <TableCell>{formatDuration(punch.punch_in, punch.punch_out)}</TableCell>
                      <TableCell>
                        <Badge variant={punch.punch_out ? "secondary" : "default"}>
                          {punch.punch_out ? "Completed" : "Clocked In"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Time Off Tab */}
          <TabsContent value="time-off" className="mt-4">
            {timeOffRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarOff className="h-8 w-8 mb-2" />
                <p>No time off requests</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeOffRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="capitalize">{req.request_type.replace("_", " ")}</TableCell>
                      <TableCell>{format(parseISO(req.start_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{format(parseISO(req.end_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{req.hours ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(req.status) as any}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(parseISO(req.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {req.status === "pending" && (
                          <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => handleCancelRequest(req.id)}>
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* My Team Tab */}
          <TabsContent value="team" className="mt-4">
            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users2 className="h-8 w-8 mb-2" />
                <p>Not assigned to any team</p>
              </div>
            ) : (
              <div className="space-y-6">
                {teams.map((team) => (
                  <div key={team.id} className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold">{team.name}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {team.members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.employee.first_name} {member.employee.last_name}
                              {member.employee.id === employee.id && (
                                <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                              )}
                            </TableCell>
                            <TableCell>{member.employee.job_title || "-"}</TableCell>
                            <TableCell>{member.employee.email || "-"}</TableCell>
                            <TableCell className="capitalize">{member.role}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* New Time Off Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className={isMaximized ? "!max-w-full !h-full !rounded-none !m-0" : "max-w-lg"}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-10 top-4 h-6 w-6"
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <DialogHeader>
            <DialogTitle>New Time Off Request</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={requestForm.request_type} onValueChange={(v) => setRequestForm({ ...requestForm, request_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={requestForm.start_date}
                  onChange={(e) => setRequestForm({ ...requestForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={requestForm.end_date}
                  onChange={(e) => setRequestForm({ ...requestForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hours (optional)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={requestForm.hours}
                onChange={(e) => setRequestForm({ ...requestForm, hours: e.target.value })}
                placeholder="Leave blank for full days"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                rows={2}
                placeholder="Additional details..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={handleSubmitTimeOff} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Submit Request
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Me;
