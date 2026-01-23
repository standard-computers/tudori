import { useEffect, useState, useRef, useMemo } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SortableTableHead } from '@/components/SortableTableHead';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, Users2, UserPlus, UserMinus } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Team {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  member_count?: number;
}

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

const MEMBER_ROLES = ['member', 'lead', 'manager'];

const TeamTable = ({
  teams,
  onEdit,
  onDelete,
  onManageMembers,
}: {
  teams: Team[];
  onEdit: (team: Team) => void;
  onDelete: (id: string) => void;
  onManageMembers: (team: Team) => void;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(teams, 'team_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {teams.length} teams
          </span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
          {Object.entries(filters).map(([key, value]) => value && (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {value}
              <button onClick={() => setFilter(key, '')} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                label="ID"
                sortKey="team_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['team_id']}
                onFilter={(value) => setFilter('team_id', value)}
                className="w-24"
              />
              <SortableTableHead
                label="Name"
                sortKey="name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['name']}
                onFilter={(value) => setFilter('name', value)}
              />
              <SortableTableHead
                label="Description"
                sortKey="description"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['description']}
                onFilter={(value) => setFilter('description', value)}
              />
              <SortableTableHead
                label="Members"
                sortKey="member_count"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                className="w-24"
              />
              <SortableTableHead
                label="Actions"
                sortKey=""
                currentSortKey=""
                currentSortDirection="asc"
                onSort={() => {}}
                className="w-32 text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-mono text-xs">{team.team_id}</TableCell>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell className="text-muted-foreground">{team.description || '-'}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{team.member_count || 0}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onManageMembers(team)} title="Manage members">
                      <Users2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(team)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(team.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedAndFilteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No teams found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const Teams = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextTeamId, setNextTeamId] = useState('0001');
  
  // Members management state
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmployeeId, setNewMemberEmployeeId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  const [formData, setFormData] = useState({
    team_id: '',
    name: '',
    description: '',
  });

  const employeeOptions: SearchableSelectOption[] = useMemo(() => {
    const memberEmployeeIds = teamMembers.map(m => m.employee_id);
    return employees
      .filter(e => !memberEmployeeIds.includes(e.id))
      .map((e) => ({
        value: e.id,
        label: `${e.first_name} ${e.last_name}`,
        sublabel: e.job_title || e.employee_id,
      }));
  }, [employees, teamMembers]);

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'team/edit' : 'team/new');
    } else if (isMembersDialogOpen) {
      setTransaction('team/members');
    } else {
      setTransaction('team');
    }
  }, [isDialogOpen, isMembersDialogOpen, isEditing, setTransaction]);

  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchTeams();
      fetchEmployees();
      fetchNextTeamId();
    }
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

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('company_id', companyId)
      .order('team_id');

    if (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
      return;
    }

    // Get member counts
    const { data: memberCounts } = await supabase
      .from('team_members')
      .select('team_id');

    const countMap = new Map<string, number>();
    memberCounts?.forEach(m => {
      countMap.set(m.team_id, (countMap.get(m.team_id) || 0) + 1);
    });

    const teamsWithCounts = (data || []).map(t => ({
      ...t,
      member_count: countMap.get(t.id) || 0,
    }));

    setTeams(teamsWithCounts);
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

  const fetchNextTeamId = async () => {
    const { data } = await supabase.rpc('get_next_team_id', {
      p_company_id: companyId,
    });
    if (data) {
      setNextTeamId(data);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
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

  const handleOpenDialog = () => {
    setFormData({
      team_id: nextTeamId,
      name: '',
      description: '',
    });
    setIsEditing(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);

  const handleEdit = (team: Team) => {
    setFormData({
      team_id: team.team_id,
      name: team.name,
      description: team.description || '',
    });
    setIsEditing(true);
    setEditingId(team.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete team');
      return;
    }
    toast.success('Team deleted');
    fetchTeams();
  };

  const handleManageMembers = (team: Team) => {
    setSelectedTeam(team);
    fetchTeamMembers(team.id);
    setNewMemberEmployeeId('');
    setNewMemberRole('member');
    setIsMembersDialogOpen(true);
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !newMemberEmployeeId) return;

    const { error } = await supabase.from('team_members').insert({
      team_id: selectedTeam.id,
      employee_id: newMemberEmployeeId,
      role: newMemberRole,
    });

    if (error) {
      toast.error('Failed to add member');
      return;
    }

    toast.success('Member added');
    fetchTeamMembers(selectedTeam.id);
    fetchTeams();
    setNewMemberEmployeeId('');
    setNewMemberRole('member');
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      toast.error('Failed to remove member');
      return;
    }
    toast.success('Member removed');
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
      fetchTeams();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Team name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const teamData = {
        company_id: companyId!,
        team_id: formData.team_id,
        name: formData.name,
        description: formData.description || null,
      };

      if (isEditing && editingId) {
        const { error } = await supabase
          .from('teams')
          .update(teamData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Team updated');
      } else {
        const { error } = await supabase.from('teams').insert(teamData);
        if (error) throw error;
        toast.success('Team created');
      }

      setIsDialogOpen(false);
      fetchTeams();
      fetchNextTeamId();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save team');
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Users2 className="h-6 w-6 text-teal-500" />
              <h1 className="text-xl font-semibold">Teams</h1>
            </div>
          </div>
          <Button onClick={handleOpenDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Team
            <Kbd className="ml-2">N</Kbd>
          </Button>
        </div>
      </header>

      <main className="p-0">
        <TeamTable teams={teams} onEdit={handleEdit} onDelete={handleDelete} onManageMembers={handleManageMembers} />
      </main>

      {/* Create/Edit Team Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Team' : 'Add Team'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update team information' : 'Create a new team'}
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team_id">Team ID</Label>
              <Input
                id="team_id"
                value={formData.team_id}
                onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isEditing ? 'Update' : 'Create'}
                <Kbd className="ml-2">⌘S</Kbd>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Team Members - {selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Add or remove employees from this team
            </DialogDescription>
          </DialogHeader>
          
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
                        <Badge variant="secondary">{member.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMembersDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teams;
