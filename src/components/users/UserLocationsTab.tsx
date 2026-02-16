import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LocationRecord {
  location_id: string;
  role: string;
  locations: {
    location_id: string;
    name: string;
    status: string;
  };
}

interface UserLocationsTabProps {
  userId: string;
}

export const UserLocationsTab = ({ userId }: UserLocationsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationRecord[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('location_users')
        .select('location_id, role, locations(location_id, name, status)')
        .eq('user_id', userId);

      if (!error && data) {
        setLocations(data as unknown as LocationRecord[]);
      }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (locations.length === 0) {
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
      {locations.map((loc) => (
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">{loc.role || 'member'}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
};
