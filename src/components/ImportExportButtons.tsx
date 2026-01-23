import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Upload, FileDown, FileUp } from 'lucide-react';
import { toast } from 'sonner';

interface ImportExportButtonsProps {
  importEnabled: boolean;
  exportEnabled: boolean;
  onImport?: (file: File) => void;
  onExport?: () => void;
  onDownloadTemplate?: () => void;
  entityName: string;
}

export const ImportExportButtons = ({
  importEnabled,
  exportEnabled,
  onImport,
  onExport,
  onDownloadTemplate,
  entityName,
}: ImportExportButtonsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    if (onImport) {
      fileInputRef.current?.click();
    } else {
      toast.info(`Import ${entityName} from XLSX - Coming soon`);
    }
  };

  const handleDownloadTemplate = () => {
    if (onDownloadTemplate) {
      onDownloadTemplate();
    } else {
      toast.info(`Download ${entityName} template - Coming soon`);
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
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />
      {importEnabled && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadTemplate}>
              <FileDown className="w-4 h-4 mr-2" />
              Download Template
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUploadClick}>
              <FileUp className="w-4 h-4 mr-2" />
              Upload File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
