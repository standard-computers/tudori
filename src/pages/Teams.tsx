import { useEffect, useState, useRef } from 'react';
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
  DialogBody,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SortableTableHead } from '@/components/SortableTableHead';
import { TeamEmployeesTab } from '@/components/teams/TeamEmployeesTab';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, Users2, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

interface Team {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  leader_employee_id: string | null;
  leader_name?: string;
  member_count?: number;
}

const TeamTable = ({
  teams,
  onView,
  onEdit,
  onDelete,
}: {
  teams: Team[];
  onView: (team: Team) => void;
  onEdit: (team: Team) => void;
  onDelete: (id: string) => void;
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(team)} title="View team">
                      <Eye className="h-4 w-4" />
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
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextTeamId, setNextTeamId] = useState('0001');
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [formData, setFormData] = useState({
    team_id: '',
    name: '',
    description: '',
    leader_employee_id: '',
  });

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'team/edit' : 'team/new');
    } else if (viewingTeam) {
      setTransaction('team/view');
    } else {
      setTransaction('team');
    }
  }, [isDialogOpen, viewingTeam, isEditing, setTransaction]);

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
      fetchNextTeamId();
      fetchEmployees();
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

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, job_title')
      .eq('company_id', companyId!)
      .eq('status', 'active')
      .order('last_name');
    setEmployees(data || []);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*, leader:employees!teams_leader_employee_id_fkey(id, first_name, last_name)')
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

    const teamsWithCounts = (data || []).map((t: any) => ({
      ...t,
      leader_name: t.leader ? `${t.leader.first_name} ${t.leader.last_name}` : null,
      member_count: countMap.get(t.id) || 0,
    }));

    setTeams(teamsWithCounts);
  };

  const fetchNextTeamId = async () => {
    const { data } = await supabase.rpc('get_next_team_id', {
      p_company_id: companyId,
    });
    if (data) {
      setNextTeamId(data);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      team_id: nextTeamId,
      name: '',
      description: '',
      leader_employee_id: '',
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
      leader_employee_id: team.leader_employee_id || '',
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
        leader_employee_id: formData.leader_employee_id || null,
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
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Users2 className="h-6 w-6 text-primary" />
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
        <TeamTable teams={teams} onView={setViewingTeam} onEdit={handleEdit} onDelete={handleDelete} />
      </main>

      {/* Create/Edit Team Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-2xl max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Team' : 'Add Team'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update team information' : 'Create a new team'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="employees" disabled={!isEditing}>Employees</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-4">
                <form id="team-form" ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="space-y-2">
                    <Label>Leader</Label>
                    <SearchableSelect
                      options={employees.map(e => ({
                        value: e.id,
                        label: `${e.first_name} ${e.last_name}`,
                        sublabel: e.job_title || undefined,
                      }))}
                      value={formData.leader_employee_id}
                      onValueChange={(v) => setFormData({ ...formData, leader_employee_id: v })}
                      placeholder="Select leader..."
                    />
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="employees" className="mt-4">
                {isEditing && editingId && companyId && (
                  <TeamEmployeesTab 
                    teamId={editingId} 
                    teamName={formData.name}
                    companyId={companyId} 
                    onMemberChange={fetchTeams}
                  />
                )}
              </TabsContent>
            </Tabs>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" form="team-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? 'Update' : 'Create'}
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Team Dialog */}
      <Dialog open={!!viewingTeam} onOpenChange={() => setViewingTeam(null)}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-2xl max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => {
              if (viewingTeam) {
                handleEdit(viewingTeam);
                setViewingTeam(null);
              }
            }}
            className="absolute right-[4.5rem] top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" />
              {viewingTeam?.name}
            </DialogTitle>
            <DialogDescription>
              Team ID: {viewingTeam?.team_id}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {viewingTeam && companyId && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="employees">Employees</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="font-medium">{viewingTeam.description || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Leader</p>
                    <p className="font-medium">{viewingTeam.leader_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <Badge variant="secondary">{viewingTeam.member_count || 0}</Badge>
                  </div>
                </TabsContent>
                <TabsContent value="employees" className="mt-4">
                  <TeamEmployeesTab 
                    teamId={viewingTeam.id} 
                    teamName={viewingTeam.name}
                    companyId={companyId} 
                    onMemberChange={fetchTeams}
                  />
                </TabsContent>
              </Tabs>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teams;
