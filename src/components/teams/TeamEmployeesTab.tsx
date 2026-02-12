import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

interface TeamMember {
  id: string;
  employee_id: string;
  role: string;
  employee?: Employee;
}

interface TeamEmployeesTabProps {
  teamId: string;
  teamName: string;
  companyId: string;
  onMemberChange?: () => void;
}

const MEMBER_ROLES = ['member', 'lead', 'manager'];

export const TeamEmployeesTab = ({ teamId, teamName, companyId, onMemberChange }: TeamEmployeesTabProps) => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmployeeId, setNewMemberEmployeeId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  useEffect(() => {
    if (teamId && companyId) {
      fetchData();
    }
  }, [teamId, companyId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchTeamMembers()]);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name, job_title')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('last_name');
    setEmployees(data || []);
  };

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        id,
        employee_id,
        role,
        employee:employees(id, employee_id, first_name, last_name, job_title)
      `)
      .eq('team_id', teamId);

    if (error) {
      console.error('Error fetching team members:', error);
      return;
    }

    setTeamMembers((data || []).map(m => ({
      ...m,
      employee: m.employee as unknown as Employee,
    })));
  };

  const employeeOptions: SearchableSelectOption[] = employees
    .filter(e => !teamMembers.some(m => m.employee_id === e.id))
    .map((e) => ({
      value: e.id,
      label: `${e.first_name} ${e.last_name}`,
      sublabel: e.job_title || e.employee_id,
    }));

  const handleAddMember = async () => {
    if (!newMemberEmployeeId) return;

    const { error } = await supabase.from('team_members').insert({
      team_id: teamId,
      employee_id: newMemberEmployeeId,
      role: newMemberRole,
    });

    if (error) {
      toast.error('Failed to add member');
      return;
    }

    // Also update the employee's department to this team name
    await supabase
      .from('employees')
      .update({ department: teamName })
      .eq('id', newMemberEmployeeId);

    toast.success('Member added');
    fetchTeamMembers();
    onMemberChange?.();
    setNewMemberEmployeeId('');
    setNewMemberRole('member');
  };

  const handleRemoveMember = async (memberId: string, employeeId: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      toast.error('Failed to remove member');
      return;
    }

    // Clear the employee's department
    await supabase
      .from('employees')
      .update({ department: null })
      .eq('id', employeeId);

    toast.success('Member removed');
    fetchTeamMembers();
    onMemberChange?.();
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to update role');
      return;
    }

    toast.success('Role updated');
    fetchTeamMembers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add member form */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label>Add Employee</Label>
          <SearchableSelect
            options={employeeOptions}
            value={newMemberEmployeeId}
            onValueChange={setNewMemberEmployeeId}
            placeholder="Select employee..."
          />
        </div>
        <div className="w-32">
          <Label>Role</Label>
          <Select value={newMemberRole} onValueChange={setNewMemberRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddMember} disabled={!newMemberEmployeeId}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {/* Current members list */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell className="font-medium">Employee</TableCell>
              <TableCell className="font-medium">Role</TableCell>
              <TableCell className="font-medium w-20"></TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {member.employee?.first_name} {member.employee?.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.employee?.job_title || member.employee?.employee_id}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v)}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemoveMember(member.id, member.employee_id)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {teamMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No members in this team
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
