import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Building2, ArrowLeft, UserPlus, Shield, Loader2, Trash2, Edit2 } from 'lucide-react';
import { z } from 'zod';

interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

interface UserRole {
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['admin', 'member', 'viewer']),
});

const roleColors: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  admin: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  member: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  viewer: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const roleDescriptions: Record<string, string> = {
  owner: 'Full access to all features and settings',
  admin: 'Can manage users and most settings',
  member: 'Can access and edit business data',
  viewer: 'Read-only access to data',
};

const Users = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Invite form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTeamData();
    }
  }, [user]);

  const fetchTeamData = async () => {
    setLoading(true);
    
    // Get current user's profile and company
    const { data: profileData } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (!profileData?.company_id) {
      toast.error('No company found');
      setLoading(false);
      return;
    }

    setCompanyId(profileData.company_id);

    // Get current user's role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id)
      .eq('company_id', profileData.company_id)
      .single();

    setCurrentUserRole(roleData?.role || null);

    // Get all team members
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name')
      .eq('company_id', profileData.company_id);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('company_id', profileData.company_id);

    if (profiles && roles) {
      const rolesMap = new Map<string, UserRole['role']>();
      roles.forEach((r) => rolesMap.set(r.user_id, r.role as UserRole['role']));

      const members: TeamMember[] = profiles.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        role: rolesMap.get(p.user_id) || 'member',
      }));

      // Sort: owner first, then admin, member, viewer
      const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
      members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

      setTeamMembers(members);
    }

    setLoading(false);
  };

  const canManageUsers = currentUserRole === 'owner' || currentUserRole === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inviteSchema.safeParse({ email, firstName, lastName, role });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!companyId) {
      toast.error('No company found');
      return;
    }

    setInviteLoading(true);

    // Create user account with temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    if (authError) {
      toast.error(authError.message);
      setInviteLoading(false);
      return;
    }

    if (authData.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
        });

      if (profileError) {
        toast.error('Failed to create profile: ' + profileError.message);
        setInviteLoading(false);
        return;
      }

      // Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          company_id: companyId,
          role,
        });

      if (roleError) {
        toast.error('Failed to assign role: ' + roleError.message);
        setInviteLoading(false);
        return;
      }

      toast.success(`User ${firstName} ${lastName} has been invited!`);
      setIsDialogOpen(false);
      resetForm();
      fetchTeamData();
    }

    setInviteLoading(false);
  };

  const handleUpdateRole = async (member: TeamMember, newRole: 'admin' | 'member' | 'viewer') => {
    if (!companyId) return;
    
    // Prevent changing owner role
    if (member.role === 'owner') {
      toast.error('Cannot change owner role');
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', member.user_id)
      .eq('company_id', companyId);

    if (error) {
      toast.error('Failed to update role: ' + error.message);
      return;
    }

    toast.success(`Updated ${member.first_name}'s role to ${newRole}`);
    fetchTeamData();
    setEditingMember(null);
  };

  const handleRemoveUser = async (member: TeamMember) => {
    if (!companyId) return;
    
    if (member.role === 'owner') {
      toast.error('Cannot remove the owner');
      return;
    }

    if (member.user_id === user!.id) {
      toast.error('Cannot remove yourself');
      return;
    }

    // Remove role
    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', member.user_id)
      .eq('company_id', companyId);

    if (roleError) {
      toast.error('Failed to remove user: ' + roleError.message);
      return;
    }

    // Update profile to remove company association
    await supabase
      .from('profiles')
      .update({ company_id: null })
      .eq('user_id', member.user_id);

    toast.success(`${member.first_name} has been removed from the team`);
    fetchTeamData();
  };

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole('member');
    setErrors({});
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-lg font-display font-bold text-foreground">Users & Access</span>
              </div>
            </div>

            {canManageUsers && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Invite a new user to join your organization
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInvite} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={errors.firstName ? 'border-destructive' : ''}
                        />
                        {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={errors.lastName ? 'border-destructive' : ''}
                        />
                        {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Access Level</Label>
                      <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member' | 'viewer')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviteLoading}>
                        {inviteLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Add User
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {(['owner', 'admin', 'member', 'viewer'] as const).map((r) => {
            const count = teamMembers.filter((m) => m.role === r).length;
            return (
              <Card key={r} className="glass-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground capitalize">{r}s</p>
                      <p className="text-2xl font-display font-bold">{count}</p>
                    </div>
                    <Badge variant="outline" className={roleColors[r]}>
                      {r}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Team members table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Team Members</CardTitle>
            <CardDescription>Manage your organization's users and their access levels</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {member.first_name[0]}{member.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.first_name} {member.last_name}</p>
                          {member.user_id === user?.id && (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingMember?.id === member.id && member.role !== 'owner' ? (
                        <Select 
                          value={member.role} 
                          onValueChange={(v) => handleUpdateRole(member, v as 'admin' | 'member' | 'viewer')}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={roleColors[member.role]}>
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageUsers && member.role !== 'owner' && member.user_id !== user?.id && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMember(editingMember?.id === member.id ? null : member)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveUser(member)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Users;
