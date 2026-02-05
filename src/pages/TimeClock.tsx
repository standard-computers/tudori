import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Clock, LogIn, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
}

interface TimePunch {
  id: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
}

const TimeClock = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activePunch, setActivePunch] = useState<TimePunch | null>(null);
  const [recentPunches, setRecentPunches] = useState<TimePunch[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPunching, setIsPunching] = useState(false);

  // F1 to go back to dashboard
  useKeyboardShortcut('F1', () => navigate('/dashboard'));

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    // Get user's profile and company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    setCompanyId(profile.company_id);

    // Find employee linked to this user
    const { data: emp } = await supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name')
      .eq('company_id', profile.company_id)
      .eq('user_id', user!.id)
      .single();

    if (emp) {
      setEmployee(emp);
      await fetchPunches(emp.id);
    }

    setLoading(false);
  };

  const fetchPunches = async (employeeId: string) => {
    // Check for active punch (no punch_out)
    const { data: active } = await supabase
      .from('time_punches')
      .select('*')
      .eq('employee_id', employeeId)
      .is('punch_out', null)
      .order('punch_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    setActivePunch(active);

    // Get recent punches
    const { data: recent } = await supabase
      .from('time_punches')
      .select('*')
      .eq('employee_id', employeeId)
      .order('punch_in', { ascending: false })
      .limit(10);

    setRecentPunches(recent || []);
  };

  const handleClockIn = async () => {
    if (!employee || !companyId) return;
    setIsPunching(true);

    const { error } = await supabase.from('time_punches').insert({
      employee_id: employee.id,
      company_id: companyId,
      punch_in: new Date().toISOString(),
    });

    if (error) {
      toast.error('Failed to clock in');
      console.error(error);
    } else {
      toast.success('Clocked in successfully!');
      await fetchPunches(employee.id);
    }
    setIsPunching(false);
  };

  const handleClockOut = async () => {
    if (!employee || !activePunch) return;
    setIsPunching(true);

    const { error } = await supabase
      .from('time_punches')
      .update({ punch_out: new Date().toISOString() })
      .eq('id', activePunch.id);

    if (error) {
      toast.error('Failed to clock out');
      console.error(error);
    } else {
      toast.success('Clocked out successfully!');
      await fetchPunches(employee.id);
    }
    setIsPunching(false);
  };

  const formatDuration = (punchIn: string, punchOut: string | null) => {
    const end = punchOut ? parseISO(punchOut) : new Date();
    const minutes = differenceInMinutes(end, parseISO(punchIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-cyan-500" />
              <h1 className="text-xl font-semibold">Time Clock</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {!employee ? (
          <Card>
            <CardHeader>
              <CardTitle>No Employee Profile Linked</CardTitle>
              <CardDescription>
                Your user account is not linked to an employee record. Please contact your administrator.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Clock In/Out Card */}
            <Card className="overflow-hidden">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">
                  Welcome, {employee.first_name} {employee.last_name}
                </CardTitle>
                <CardDescription>
                  Employee ID: {employee.employee_id}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Time Display */}
                <div className="text-center">
                  <p className="text-6xl font-mono font-bold tracking-tight">
                    {format(currentTime, 'h:mm:ss')}
                  </p>
                  <p className="text-xl text-muted-foreground mt-1">
                    {format(currentTime, 'a')}
                  </p>
                  <p className="text-muted-foreground mt-2">
                    {format(currentTime, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>

                {/* Status */}
                {activePunch && (
                  <div className="text-center bg-primary/10 rounded-lg p-4">
                    <Badge variant="default" className="text-lg px-4 py-1">
                      Clocked In
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Since {format(parseISO(activePunch.punch_in), 'h:mm a')} ({formatDuration(activePunch.punch_in, null)})
                    </p>
                  </div>
                )}

                {/* Clock Buttons */}
                <div className="flex justify-center gap-4">
                  <Button
                    size="lg"
                    className="h-16 px-8 text-lg"
                    onClick={handleClockIn}
                    disabled={!!activePunch || isPunching}
                  >
                    {isPunching ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <LogIn className="h-5 w-5 mr-2" />
                    )}
                    Clock In
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 px-8 text-lg"
                    onClick={handleClockOut}
                    disabled={!activePunch || isPunching}
                  >
                    {isPunching ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="h-5 w-5 mr-2" />
                    )}
                    Clock Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Punches */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Time Entries</CardTitle>
                <CardDescription>Your last 10 time punches</CardDescription>
              </CardHeader>
              <CardContent>
                {recentPunches.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No time entries yet</p>
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
                      {recentPunches.map((punch) => (
                        <TableRow key={punch.id}>
                          <TableCell className="font-medium">
                            {format(parseISO(punch.punch_in), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(punch.punch_in), 'h:mm a')}
                          </TableCell>
                          <TableCell>
                            {punch.punch_out ? format(parseISO(punch.punch_out), 'h:mm a') : '-'}
                          </TableCell>
                          <TableCell>
                            {formatDuration(punch.punch_in, punch.punch_out)}
                          </TableCell>
                          <TableCell>
                            {punch.punch_out ? (
                              <Badge variant="secondary">Completed</Badge>
                            ) : (
                              <Badge variant="default">Active</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default TimeClock;
