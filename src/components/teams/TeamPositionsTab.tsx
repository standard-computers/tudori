import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

interface Position {
  id: string;
  name: string;
  status: string | null;
  vacancies: number | null;
  open_date: string | null;
  employee?: { first_name: string; last_name: string } | null;
}

export const TeamPositionsTab = ({ teamId }: { teamId: string }) => {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (teamId) fetchPositions();
  }, [teamId]);

  const fetchPositions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('positions')
      .select('id, name, status, vacancies, open_date, employee:employees(first_name, last_name)')
      .eq('team_id', teamId)
      .order('name');

    if (error) {
      console.error('Error fetching team positions:', error);
    }
    setPositions((data || []) as unknown as Position[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell className="font-medium">Position</TableCell>
            <TableCell className="font-medium">Status</TableCell>
            <TableCell className="font-medium">Vacancies</TableCell>
            <TableCell className="font-medium">Employee</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos) => (
            <TableRow key={pos.id}>
              <TableCell className="font-medium">{pos.name}</TableCell>
              <TableCell>
                <Badge variant={pos.status === 'open' ? 'default' : 'secondary'}>
                  {pos.status || '-'}
                </Badge>
              </TableCell>
              <TableCell>{pos.vacancies ?? '-'}</TableCell>
              <TableCell className="text-muted-foreground">
                {pos.employee ? `${pos.employee.first_name} ${pos.employee.last_name}` : '-'}
              </TableCell>
            </TableRow>
          ))}
          {positions.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                No positions in this team
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
