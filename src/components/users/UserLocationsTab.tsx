import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

interface LocationRecord {
  location_id: string;
  role: string;
  locations: {
    id: string;
    location_id: string;
    name: string;
    status: string;
  };
}

interface CompanyLocation {
  id: string;
  location_id: string;
  name: string;
  status: string;
}

interface UserLocationsTabProps {
  userId: string;
  companyId?: string;
  readOnly?: boolean;
}

export const UserLocationsTab = ({ userId, companyId, readOnly = true }: UserLocationsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignedLocations, setAssignedLocations] = useState<LocationRecord[]>([]);
  const [allLocations, setAllLocations] = useState<CompanyLocation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [originalRoles, setOriginalRoles] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);

    const assignedPromise = supabase
      .from('location_users')
      .select('location_id, role, locations(id, location_id, name, status)')
      .eq('user_id', userId);

    const allPromise = !readOnly && companyId
      ? supabase
          .from('locations')
          .select('id, location_id, name, status')
          .eq('company_id', companyId)
          .order('location_id')
      : null;

    const [assignedRes, allRes] = await Promise.all([
      assignedPromise,
      allPromise,
    ]);

    if (!assignedRes.error && assignedRes.data) {
      const records = assignedRes.data as unknown as LocationRecord[];
      setAssignedLocations(records);
      const ids = records.map((r) => r.location_id);
      const roleMap: Record<string, string> = {};
      records.forEach((r) => { roleMap[r.location_id] = r.role || 'member'; });
      setSelectedIds(ids);
      setOriginalIds(ids);
      setRoles(roleMap);
      setOriginalRoles({ ...roleMap });
    }

    if (!readOnly && allRes && !allRes.error && allRes.data) {
      setAllLocations(allRes.data as CompanyLocation[]);
    }

    setLoading(false);
  }, [userId, companyId, readOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasChanges =
    selectedIds.length !== originalIds.length ||
    selectedIds.some((id) => !originalIds.includes(id)) ||
    originalIds.some((id) => !selectedIds.includes(id)) ||
    selectedIds.some((id) => roles[id] !== originalRoles[id]);

  const handleToggle = (locId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, locId]);
      setRoles((prev) => ({ ...prev, [locId]: prev[locId] || 'member' }));
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== locId));
    }
  };

  const handleRoleChange = (locId: string, role: string) => {
    setRoles((prev) => ({ ...prev, [locId]: role }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAdd = selectedIds.filter((id) => !originalIds.includes(id));
      const toRemove = originalIds.filter((id) => !selectedIds.includes(id));
      const toUpdate = selectedIds.filter(
        (id) => originalIds.includes(id) && roles[id] !== originalRoles[id]
      );

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('location_users')
          .insert(toAdd.map((locId) => ({
            location_id: locId,
            user_id: userId,
            role: roles[locId] || 'member',
          })));
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('location_users')
          .delete()
          .eq('user_id', userId)
          .in('location_id', toRemove);
        if (error) throw error;
      }

      for (const locId of toUpdate) {
        const { error } = await supabase
          .from('location_users')
          .update({ role: roles[locId] })
          .eq('user_id', userId)
          .eq('location_id', locId);
        if (error) throw error;
      }

      setOriginalIds([...selectedIds]);
      setOriginalRoles({ ...roles });
      toast.success('User locations updated');
    } catch (err: any) {
      console.error('Failed to save user locations:', err);
      toast.error('Failed to update locations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Read-only mode
  if (readOnly) {
    if (assignedLocations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MapPin className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">No locations assigned</p>
          <p className="text-sm mt-1">This user is not assigned to any locations</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {assignedLocations.map((loc) => (
          <div
            key={loc.location_id}
            className="flex items-center justify-between p-3 rounded-lg border border-border"
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{loc.locations.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{loc.locations.location_id}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs capitalize">{loc.role || 'member'}</Badge>
          </div>
        ))}
      </div>
    );
  }

  // Editable mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedIds.length} of {allLocations.length} location{allLocations.length !== 1 ? 's' : ''} assigned
        </p>
        <div className="flex items-center gap-2">
          {allLocations.length > 0 && (
            <Select onValueChange={(role) => {
              const allIds = allLocations.map((l) => l.id);
              setSelectedIds(allIds);
              const newRoles = { ...roles };
              allIds.forEach((id) => { newRoles[id] = role; });
              setRoles(newRoles);
            }}>
              <SelectTrigger className="w-auto h-8 text-xs gap-1">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Add All as Member</SelectItem>
                <SelectItem value="admin">Add All as Admin</SelectItem>
              </SelectContent>
            </Select>
          )}
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          )}
        </div>
      </div>

      {allLocations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MapPin className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">No locations found</p>
          <p className="text-sm mt-1">No locations exist in your company yet</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
          {allLocations.map((loc) => {
            const isSelected = selectedIds.includes(loc.id);
            return (
              <div key={loc.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                <Checkbox
                  id={`user-loc-${loc.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleToggle(loc.id, checked as boolean)}
                />
                <label htmlFor={`user-loc-${loc.id}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{loc.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">({loc.location_id})</span>
                  </div>
                </label>
                {isSelected && (
                  <Select
                    value={roles[loc.id] || 'member'}
                    onValueChange={(value) => handleRoleChange(loc.id, value)}
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
    </div>
  );
};
