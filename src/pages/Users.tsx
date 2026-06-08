import { useEffect, useState } from 'react';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction, useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/lib/toast';
import { Kbd } from '@/components/ui/kbd';
import { Building2, ArrowLeft, UserPlus, Shield, Loader2, Trash2, Edit2, Mail, Clock, Eye, Copy, Check, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { z } from 'zod';
import { TransactionAccessTab } from '@/components/users/TransactionAccessTab';
import { UserLocationsTab } from '@/components/users/UserLocationsTab';

interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  profile_id?: string;
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

const InvitationRow = ({ invitation, canManageUsers, onCancel }: { 
  invitation: Invitation; 
  canManageUsers: boolean; 
  onCancel: (id: string) => void;
}) => {
  return (
    <TableRow>
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
            onClick={() => onCancel(invitation.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

const CreatedPasswordDialog = ({ open, onOpenChange, email, tempPassword }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  email: string; 
  tempPassword: string; 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User Created Successfully</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A user account has been created for <strong>{email}</strong>. Copy the temporary password below and share it securely. <strong>This password will not be shown again.</strong>
          </p>
          <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-muted/30">
            <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono flex-1">
              {tempPassword}
            </code>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCopy} title="Copy">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-destructive">⚠️ Save this password now. It cannot be retrieved later.</p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [viewingMember, setViewingMember] = useState<TeamMember | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noCompany, setNoCompany] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Set transaction based on dialog state
  useEffect(() => {
    setTransaction(isDialogOpen ? 'user/new' : 'user');
  }, [isDialogOpen, setTransaction]);

  // Invite form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer' | 'it'>('member');
  const [createdPasswordEmail, setCreatedPasswordEmail] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

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

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id)
      .eq('company_id', profileData.company_id)
      .maybeSingle();

    if (roleError) {
      console.error('Error fetching role:', roleError);
    }
    
    setCurrentUserRole(roleData?.role || null);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name, email, profile_id')
      .eq('company_id', profileData.company_id);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('company_id', profileData.company_id);

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
        email: p.email || undefined,
        role: rolesMap.get(p.user_id) || 'member',
      }));

      const roleOrder: Record<string, number> = { it: 0, owner: 1, admin: 2, member: 3, viewer: 4 };
      members.sort((a, b) => (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5));

      setTeamMembers(members);
    }

    setLoading(false);
  };

  const canManageUsers = currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'it';

  const openInviteDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', openInviteDialog, canManageUsers);
  useTransactionAction('new', openInviteDialog, canManageUsers);

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

      const { data, error: fnError } = await supabase.functions.invoke('create-invited-user', {
        body: {
          email: email.toLowerCase(),
          role,
          company_id: companyId,
        },
      });

      if (fnError) {
        toast.error('Failed to create invitation: ' + fnError.message);
        setInviteLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setInviteLoading(false);
        return;
      }

      toast.success(`User created for ${email}.`);
      setCreatedPasswordEmail(email.toLowerCase());
      setCreatedTempPassword(data.temp_password);
      setIsDialogOpen(false);
      setShowPasswordDialog(true);
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
    
    if (member.role === 'owner') {
      toast.error('Cannot change owner role');
      return;
    }
    if (member.user_id === user?.id) {
      toast.error('Cannot change your own role');
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

    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', member.user_id)
      .eq('company_id', companyId);

    if (roleError) {
      toast.error('Failed to remove user: ' + roleError.message);
      return;
    }

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
        <header className="sticky top-0 z-50">
          <div className="px-4">
            <div className="flex items-center h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                  <ArrowLeft className="w-5 h-5" />
                  <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
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
      <header className="sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <div className="flex items-center gap-3">
                <Shield className="w-7 h-7 text-purple-500" />
                <span className="text-lg font-display font-bold text-foreground">Users & Access</span>
              </div>
            </div>

            {canManageUsers && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="icon" className="relative">
                    <UserPlus className="w-4 h-4" />
                    <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Create a user account with a temporary password. Share the credentials with them so they can log in.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <form id="invite-form" onSubmit={handleInvite} className="space-y-4">
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
                    </form>
                  </DialogBody>
                  <DialogFooter>
                    <Button type="submit" form="invite-form" disabled={inviteLoading}>
                      {inviteLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Main content - Tabbed layout */}
      <main className="px-4">
        <Tabs defaultValue="members" className="w-full">
          <TabsList>
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="invitations">
              Invitations
              {invitations.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                  {invitations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <div>
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => {
                    const canEditMember = canManageUsers && member.role !== 'owner' && member.user_id !== user?.id;
                    return (
                    <TableRow 
                      key={member.id} 
                      className={canEditMember ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => {
                        if (canEditMember) {
                          setEditingMember(member);
                        }
                      }}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{member.profile_id || '—'}</TableCell>
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
                        <span className="text-muted-foreground">{member.email || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[member.role]}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingMember(member);
                            }}
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEditMember && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMember(member);
                              }}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="invitations">
            {invitations.length === 0 ? (
              <div className="border rounded-t-md flex items-center justify-center h-48 text-muted-foreground">
                No pending invitations
              </div>
            ) : (
              <div>
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
                      <InvitationRow
                        key={invitation.id}
                        invitation={invitation}
                        canManageUsers={canManageUsers}
                        onCancel={handleCancelInvitation}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
           <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-1 absolute right-12 top-2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  onClick={() => setConfirmDeleteOpen(true)}
                  title="Remove user"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update {editingMember?.first_name} {editingMember?.last_name}'s access level and permissions
                  </DialogDescription>
              </div>
            </DialogHeader>
            <DialogBody>
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="locations">Locations</TabsTrigger>
                  <TabsTrigger value="access">Transaction Access</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="mt-4 space-y-4">
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
                </TabsContent>
                <TabsContent value="locations" className="mt-4">
                  {editingMember && companyId && (
                    <UserLocationsTab userId={editingMember.user_id} companyId={companyId} readOnly={false} />
                  )}
                </TabsContent>
                <TabsContent value="access" className="mt-4">
                  {editingMember && companyId && (
                    <TransactionAccessTab 
                      userId={editingMember.user_id} 
                      companyId={companyId}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* View User Dialog (Read-only) */}
        <Dialog open={!!viewingMember} onOpenChange={(open) => !open && setViewingMember(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>View User</DialogTitle>
              <DialogDescription>
                {viewingMember?.first_name} {viewingMember?.last_name}'s profile and permissions
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="locations">Locations</TabsTrigger>
                  <TabsTrigger value="access">Transaction Access</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="mt-4 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {viewingMember?.first_name[0]}{viewingMember?.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{viewingMember?.first_name} {viewingMember?.last_name}</p>
                      <Badge variant="outline" className={viewingMember ? roleColors[viewingMember.role] : ''}>
                        {viewingMember?.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Role Description</Label>
                    <p className="text-sm">
                      {viewingMember && roleDescriptions[viewingMember.role]}
                    </p>
                  </div>
                  {(() => {
                    const matchingInvitation = viewingMember && canManageUsers
                      ? invitations.find((inv) => inv.email === viewingMember.email)
                      : null;
                    if (!matchingInvitation) return null;
                    return (
                      <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Outstanding Invitation
                        </Label>
                        <p className="text-xs text-muted-foreground">This user has a pending invitation. The temporary password was shown only at creation time.</p>
                      </div>
                    );
                  })()}
                </TabsContent>
                <TabsContent value="locations" className="mt-4">
                  {viewingMember && (
                    <UserLocationsTab userId={viewingMember.user_id} />
                  )}
                </TabsContent>
                <TabsContent value="access" className="mt-4">
                  {viewingMember && companyId && (
                    <TransactionAccessTab 
                      userId={viewingMember.user_id} 
                      companyId={companyId}
                      readOnly={true}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </DialogBody>
          </DialogContent>
        </Dialog>
        <CreatedPasswordDialog 
          open={showPasswordDialog} 
          onOpenChange={setShowPasswordDialog} 
          email={createdPasswordEmail} 
          tempPassword={createdTempPassword} 
        />
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Remove User"
          description={`Are you sure you want to remove ${editingMember?.first_name} ${editingMember?.last_name} from the team? This action cannot be undone.`}
          onConfirm={() => {
            if (editingMember) {
              handleRemoveUser(editingMember);
              setEditingMember(null);
              setConfirmDeleteOpen(false);
            }
          }}
        />
      </main>
    </div>
  );
};

export default Users;
