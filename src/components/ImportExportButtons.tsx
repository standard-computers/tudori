import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ImportExportButtonsProps {
  importEnabled: boolean;
  exportEnabled: boolean;
  onImport?: () => void;
  onExport?: () => void;
  entityName: string;
}

export const ImportExportButtons = ({
  importEnabled,
  exportEnabled,
  onImport,
  onExport,
  entityName,
}: ImportExportButtonsProps) => {
  const handleImport = () => {
    if (onImport) {
      onImport();
    } else {
      toast.info(`Import ${entityName} from XLSX - Coming soon`);
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      toast.info(`Export ${entityName} to XLSX - Coming soon`);
    }
  };

  if (!importEnabled && !exportEnabled) {
    return null;
  }

  return (
    <>
      {importEnabled && (
        <Button variant="outline" onClick={handleImport}>
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
      )}
      {exportEnabled && (
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      )}
    </>
  );
};
