import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  area_id: string;
  picking_sequence?: number | null;
  put_away_sequence?: number | null;
}

interface Area {
  id: string;
  area_id: string;
  name: string;
}

interface BinSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bins: Bin[];
  areas: Area[];
  onSaved: () => void;
}

type SequenceType = 'picking' | 'put_away';

const BinSequenceDialog = ({ open, onOpenChange, bins, areas, onSaved }: BinSequenceDialogProps) => {
  const [activeTab, setActiveTab] = useState<SequenceType>('picking');
  const [pickingSequences, setPickingSequences] = useState<Record<string, number | null>>({});
  const [putAwaySequences, setPutAwaySequences] = useState<Record<string, number | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (open) {
      const pickMap: Record<string, number | null> = {};
      const putMap: Record<string, number | null> = {};
      bins.forEach(b => {
        pickMap[b.id] = b.picking_sequence ?? null;
        putMap[b.id] = b.put_away_sequence ?? null;
      });
      setPickingSequences(pickMap);
      setPutAwaySequences(putMap);
    }
  }, [open, bins]);

  const getAreaName = (areaId: string) => {
    const area = areas.find(a => a.id === areaId);
    return area ? `${area.area_id} — ${area.name}` : areaId;
  };

  const getSortedBins = (type: SequenceType) => {
    const seqMap = type === 'picking' ? pickingSequences : putAwaySequences;
    return [...bins].sort((a, b) => {
      const seqA = seqMap[a.id];
      const seqB = seqMap[b.id];
      if (seqA == null && seqB == null) return a.bin_id.localeCompare(b.bin_id);
      if (seqA == null) return 1;
      if (seqB == null) return -1;
      return seqA - seqB;
    });
  };

  const handleSequenceChange = (binId: string, value: string, type: SequenceType) => {
    const setter = type === 'picking' ? setPickingSequences : setPutAwaySequences;
    const numVal = value === '' ? null : parseInt(value, 10);
    setter(prev => ({ ...prev, [binId]: isNaN(numVal as number) ? null : numVal }));
  };

  const autoNumber = (type: SequenceType) => {
    const sorted = [...bins].sort((a, b) => a.bin_id.localeCompare(b.bin_id));
    const newSeq: Record<string, number | null> = {};
    sorted.forEach((bin, i) => {
      newSeq[bin.id] = i + 1;
    });
    if (type === 'picking') setPickingSequences(newSeq);
    else setPutAwaySequences(newSeq);
  };

  const clearAll = (type: SequenceType) => {
    const newSeq: Record<string, number | null> = {};
    bins.forEach(b => { newSeq[b.id] = null; });
    if (type === 'picking') setPickingSequences(newSeq);
    else setPutAwaySequences(newSeq);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = bins.map(bin =>
        supabase
          .from('bins')
          .update({
            picking_sequence: pickingSequences[bin.id] ?? null,
            put_away_sequence: putAwaySequences[bin.id] ?? null,
          })
          .eq('id', bin.id)
      );
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        toast.error('Failed to save some sequences');
        console.error('Sequence save errors:', errors.map(e => e.error));
      } else {
        toast.success('Bin sequences saved');
        onSaved();
        onOpenChange(false);
      }
    } catch (err) {
      toast.error('Failed to save sequences');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTable = (type: SequenceType) => {
    const sorted = getSortedBins(type);
    const seqMap = type === 'picking' ? pickingSequences : putAwaySequences;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => autoNumber(type)}>
            <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
            Auto Number
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clearAll(type)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {bins.filter(b => seqMap[b.id] != null).length} of {bins.length} sequenced
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Seq #</TableHead>
              <TableHead>Bin ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Area</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(bin => (
              <TableRow key={bin.id}>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-16 text-center"
                    value={seqMap[bin.id] ?? ''}
                    onChange={(e) => handleSequenceChange(bin.id, e.target.value, type)}
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="font-mono">{bin.bin_id}</TableCell>
                <TableCell>{bin.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {getAreaName(bin.area_id)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {bins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No bins available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[600px] max-h-[85vh]'}`}>
        <button
          type="button"
          onClick={() => setIsMaximized(!isMaximized)}
          className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <DialogHeader>
          <DialogTitle>Bin Sequences</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SequenceType)}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="picking">Picking Sequence</TabsTrigger>
              <TabsTrigger value="put_away">Put Away Sequence</TabsTrigger>
            </TabsList>
            <TabsContent value="picking" className="mt-0">
              {renderTable('picking')}
            </TabsContent>
            <TabsContent value="put_away" className="mt-0">
              {renderTable('put_away')}
            </TabsContent>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Sequences'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BinSequenceDialog;
