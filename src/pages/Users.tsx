import { useEffect, useState } from 'react';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction, useStatusBar } from '@/contexts/StatusBarContext';
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
import { Kbd } from '@/components/ui/kbd';
import { Building2, ArrowLeft, UserPlus, Shield, Loader2, Trash2, Edit2, Mail, Clock } from 'lucide-react';
import { z } from 'zod';

interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'it';
}

interface Invitation {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'it';
  created_at: string;
  expires_at: string;
}

interface UserRole {
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'it';
}

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'member', 'viewer', 'it']),
});

const roleColors: Record<string, string> = {
  it: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  owner: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  admin: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  member: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  viewer: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const roleDescriptions: Record<string, string> = {
  it: 'Full system access including company and ID configuration',
  owner: 'Full access to all features and settings',
  admin: 'Can manage users and most settings',
  member: 'Can access and edit business data',
  viewer: 'Read-only access to data',
};

const Users = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noCompany, setNoCompany] = useState(false);

  // Set transaction based on dialog state
  useEffect(() => {
    setTransaction(isDialogOpen ? 'user/new' : 'user');
  }, [isDialogOpen, setTransaction]);

  // Invite form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer' | 'it'>('member');

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
    setNoCompany(false);
    
    // Get current user's profile and company
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (profileError || !profileData?.company_id) {
      setNoCompany(true);
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

    // Get pending invitations
    const { data: invitationsData } = await supabase
      .from('invitations')
      .select('id, email, role, created_at, expires_at')
      .eq('company_id', profileData.company_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    if (invitationsData) {
      setInvitations(invitationsData as Invitation[]);
    }

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

      // Sort: IT first, then owner, admin, member, viewer
      const roleOrder: Record<string, number> = { it: 0, owner: 1, admin: 2, member: 3, viewer: 4 };
      members.sort((a, b) => (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5));

      setTeamMembers(members);
    }

    setLoading(false);
  };

  const canManageUsers = currentUserRole === 'owner' || currentUserRole === 'admin';

  const openInviteDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new user (only if can manage)
  useKeyboardShortcut('n', openInviteDialog, canManageUsers);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inviteSchema.safeParse({ email, role });
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

    try {
      // Check if email already has a pending invitation
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('company_id', companyId)
        .is('accepted_at', null)
        .maybeSingle();

      if (existingInvite) {
        toast.error('This email already has a pending invitation');
        setInviteLoading(false);
        return;
      }

      // Check if user already exists in the company
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId);

      // Create invitation
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert({
          email: email.toLowerCase(),
          company_id: companyId,
          role,
          invited_by: user!.id,
        });

      if (inviteError) {
        if (inviteError.code === '23505') {
          toast.error('This email has already been invited');
        } else {
          toast.error('Failed to create invitation: ' + inviteError.message);
        }
        setInviteLoading(false);
        return;
      }

      toast.success(`Invitation sent to ${email}! They can now sign up to join your company.`);
      setIsDialogOpen(false);
      resetForm();
      fetchTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      toast.error('Failed to cancel invitation');
      return;
    }

    toast.success('Invitation cancelled');
    fetchTeamData();
  };

  const handleUpdateRole = async (member: TeamMember, newRole: 'admin' | 'member' | 'viewer' | 'it') => {
    if (!companyId) return;
    
    // Prevent changing owner or IT role (IT is special)
    if (member.role === 'owner') {
      toast.error('Cannot change owner role');
      return;
    }
    if (member.role === 'it') {
      toast.error('Cannot change IT role - contact system administrator');
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

  if (noCompany) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <Shield className="w-7 h-7 text-purple-500" />
                  <span className="text-lg font-display font-bold text-foreground">Users & Access</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card className="glass-card max-w-md mx-auto text-center">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="font-display">No Company Profile</CardTitle>
              <CardDescription>
                Your account doesn't have a company profile set up yet. Please sign up with company information to access user management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/complete-profile')} className="w-full">
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        </main>
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
                <Shield className="w-7 h-7 text-purple-500" />
                <span className="text-lg font-display font-bold text-foreground">Users & Access</span>
              </div>
            </div>

            {canManageUsers && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                    <Kbd>N</Kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your organization. They'll be able to sign up with this email.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInvite} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="colleague@example.com"
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Access Level</Label>
                      <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member' | 'viewer' | 'it')}>
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
                      <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviteLoading}>
                        {inviteLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Send Invitation
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {(['it', 'owner', 'admin', 'member', 'viewer'] as const).map((r) => {
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

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>Users who have been invited but haven't signed up yet</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{invitation.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[invitation.role]}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invitation.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageUsers && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

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
                  <TableRow 
                    key={member.id} 
                    className={canManageUsers && member.role !== 'owner' && member.user_id !== user?.id ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={() => {
                      if (canManageUsers && member.role !== 'owner' && member.user_id !== user?.id) {
                        setEditingMember(member);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {member.first_name[0]}{member.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.first_name} {member.last_name}</p>
                          {member.user_id === user?.id && (
                            <p className="text-xs text-muted-foreground">You</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleColors[member.role]}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageUsers && member.role !== 'owner' && member.user_id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveUser(member);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update {editingMember?.first_name} {editingMember?.last_name}'s access level
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {editingMember?.first_name[0]}{editingMember?.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{editingMember?.first_name} {editingMember?.last_name}</p>
                  <p className="text-sm text-muted-foreground">Current role: {editingMember?.role}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select 
                  value={editingMember?.role} 
                  onValueChange={(v) => {
                    if (editingMember) {
                      handleUpdateRole(editingMember, v as 'admin' | 'member' | 'viewer' | 'it');
                    }
                  }}
                >
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
                <p className="text-sm text-muted-foreground">
                  {editingMember && roleDescriptions[editingMember.role]}
                </p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setEditingMember(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Users;
