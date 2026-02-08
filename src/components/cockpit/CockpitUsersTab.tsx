import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Loader2, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CompanyUser {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface CockpitUsersTabProps {
  locationId: string;
  companyId: string;
}

const CockpitUsersTab = ({ locationId, companyId }: CockpitUsersTabProps) => {
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [originalUserIds, setOriginalUserIds] = useState<string[]>([]);
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
        .select('user_id')
        .eq('location_id', locationId),
    ]);

    setIsLoading(false);

    if (usersRes.data) {
      setCompanyUsers(usersRes.data);
    }

    const userIds = (locationUsersRes.data || []).map((lu) => lu.user_id);
    setSelectedUserIds(userIds);
    setOriginalUserIds(userIds);
  }, [locationId, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUserToggle = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId)
    );
  };

  const hasChanges =
    selectedUserIds.length !== originalUserIds.length ||
    selectedUserIds.some((id) => !originalUserIds.includes(id));

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const toAdd = selectedUserIds.filter((id) => !originalUserIds.includes(id));
      const toRemove = originalUserIds.filter((id) => !selectedUserIds.includes(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('location_users')
          .insert(toAdd.map((userId) => ({ location_id: locationId, user_id: userId })));
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

      setOriginalUserIds([...selectedUserIds]);
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
            {companyUsers.map((companyUser) => (
              <div
                key={companyUser.user_id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                <Checkbox
                  id={`cockpit-user-${companyUser.user_id}`}
                  checked={selectedUserIds.includes(companyUser.user_id)}
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
              </div>
            ))}
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
