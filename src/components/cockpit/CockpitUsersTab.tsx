import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Loader2, AlertCircle, Save } from 'lucide-react';
import { toast } from '@/lib/toast';

interface CompanyUser {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface LocationUserRecord {
  user_id: string;
  role: string;
}

interface CockpitUsersTabProps {
  locationId: string;
  companyId: string;
}

const CockpitUsersTab = ({ locationId, companyId }: CockpitUsersTabProps) => {
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [originalUserIds, setOriginalUserIds] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [originalUserRoles, setOriginalUserRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const [usersRes, locationUsersRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name')
        .eq('company_id', companyId),
      supabase
        .from('location_users')
        .select('user_id, role')
        .eq('location_id', locationId),
    ]);

    setIsLoading(false);

    if (usersRes.data) {
      setCompanyUsers(usersRes.data);
    }

    const locationUsers = (locationUsersRes.data || []) as LocationUserRecord[];
    const userIds = locationUsers.map((lu) => lu.user_id);
    const roles: Record<string, string> = {};
    locationUsers.forEach((lu) => {
      roles[lu.user_id] = lu.role || 'member';
    });

    setSelectedUserIds(userIds);
    setOriginalUserIds(userIds);
    setUserRoles(roles);
    setOriginalUserRoles({ ...roles });
  }, [locationId, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      const newSelected = [...selectedUserIds, userId];
      setSelectedUserIds(newSelected);
      // If this will be the only user, force admin
      if (newSelected.length === 1) {
        setUserRoles((prev) => ({ ...prev, [userId]: 'admin' }));
      } else {
        setUserRoles((prev) => ({ ...prev, [userId]: prev[userId] || 'member' }));
      }
    } else {
      const newSelected = selectedUserIds.filter((id) => id !== userId);
      setSelectedUserIds(newSelected);
      // If only one user remains, force them to admin
      if (newSelected.length === 1) {
        setUserRoles((prev) => ({ ...prev, [newSelected[0]]: 'admin' }));
      }
    }
  };

  const handleRoleChange = (userId: string, role: string) => {
    // Prevent changing the sole user away from admin
    if (selectedUserIds.length === 1 && role !== 'admin') return;
    setUserRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const hasChanges =
    selectedUserIds.length !== originalUserIds.length ||
    selectedUserIds.some((id) => !originalUserIds.includes(id)) ||
    originalUserIds.some((id) => !selectedUserIds.includes(id)) ||
    selectedUserIds.some((id) => userRoles[id] !== originalUserRoles[id]);

  const handleSave = async () => {
    // Enforce: if only one user, they must be admin
    const finalRoles = { ...userRoles };
    if (selectedUserIds.length === 1) {
      finalRoles[selectedUserIds[0]] = 'admin';
    }
    setUserRoles(finalRoles);
    setIsSaving(true);

    try {
      const toAdd = selectedUserIds.filter((id) => !originalUserIds.includes(id));
      const toRemove = originalUserIds.filter((id) => !selectedUserIds.includes(id));
      const toUpdateRole = selectedUserIds.filter(
        (id) => originalUserIds.includes(id) && finalRoles[id] !== originalUserRoles[id]
      );

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('location_users')
          .insert(toAdd.map((userId) => ({
            location_id: locationId,
            user_id: userId,
            role: finalRoles[userId] || 'member',
          })));
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('location_users')
          .delete()
          .eq('location_id', locationId)
          .in('user_id', toRemove);
        if (error) throw error;
      }

      for (const userId of toUpdateRole) {
        const { error } = await supabase
          .from('location_users')
          .update({ role: finalRoles[userId] })
          .eq('location_id', locationId)
          .eq('user_id', userId);
        if (error) throw error;
      }

      setOriginalUserIds([...selectedUserIds]);
      setOriginalUserRoles({ ...finalRoles });
      toast.success('Location users updated');
    } catch (err) {
      console.error('Failed to save location users:', err);
      toast.error('Failed to update users');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Users
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedUserIds.length} of {companyUsers.length} user{companyUsers.length !== 1 ? 's' : ''} assigned
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        <p className="text-sm text-muted-foreground mb-3">
          Select users who can access this location in the Cockpit. Only selected users will be able to view and operate in this location.
        </p>

        {companyUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No users found</p>
            <p className="text-sm mt-1">No users exist in your company yet</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y max-h-[calc(100vh-16rem)] overflow-y-auto">
            {companyUsers.map((companyUser) => {
              const isSelected = selectedUserIds.includes(companyUser.user_id);
              return (
                <div
                  key={companyUser.user_id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    id={`cockpit-user-${companyUser.user_id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleUserToggle(companyUser.user_id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`cockpit-user-${companyUser.user_id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {companyUser.first_name} {companyUser.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({companyUser.id})
                      </span>
                    </div>
                  </label>
                  {isSelected && (
                    <Select
                      value={userRoles[companyUser.user_id] || 'member'}
                      onValueChange={(value) => handleRoleChange(companyUser.user_id, value)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedUserIds.length === 0 && companyUsers.length > 0 && (
          <p className="text-sm text-amber-600 flex items-center gap-1 mt-3">
            <AlertCircle className="w-3 h-3" />
            No users selected. This location won't be visible in Cockpit to anyone.
          </p>
        )}
      </div>
    </div>
  );
};

export default CockpitUsersTab;
