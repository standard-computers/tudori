import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock } from 'lucide-react';

interface TimePunch {
  id: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
}

interface TimesheetsTabProps {
  employeeId: string;
}

export const TimesheetsTab = ({ employeeId }: TimesheetsTabProps) => {
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPunches();
  }, [employeeId]);

  const fetchPunches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('time_punches')
      .select('id, punch_in, punch_out, notes')
      .eq('employee_id', employeeId)
      .order('punch_in', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching time punches:', error);
    } else {
      setPunches(data || []);
    }
    setLoading(false);
  };

  const formatDuration = (punchIn: string, punchOut: string | null) => {
    if (!punchOut) return '-';
    const minutes = differenceInMinutes(parseISO(punchOut), parseISO(punchIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (punches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2" />
        <p>No time punches recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Punch In</TableHead>
            <TableHead>Punch Out</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {punches.map((punch) => (
            <TableRow key={punch.id}>
              <TableCell className="font-medium">
                {format(parseISO(punch.punch_in), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                {format(parseISO(punch.punch_in), 'h:mm a')}
              </TableCell>
              <TableCell>
                {punch.punch_out ? format(parseISO(punch.punch_out), 'h:mm a') : '-'}
              </TableCell>
              <TableCell>
                {formatDuration(punch.punch_in, punch.punch_out)}
              </TableCell>
              <TableCell>
                {punch.punch_out ? (
                  <Badge variant="secondary">Completed</Badge>
                ) : (
                  <Badge variant="default">Clocked In</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
