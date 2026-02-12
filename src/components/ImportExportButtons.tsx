import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Upload, FileDown, FileUp } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Kbd } from '@/components/ui/kbd';

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
  const [importDropdownOpen, setImportDropdownOpen] = useState(false);

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

  const handleUploadClick = useCallback(() => {
    if (onImport) {
      fileInputRef.current?.click();
    } else {
      toast.info(`Import ${entityName} from XLSX - Coming soon`);
    }
    setImportDropdownOpen(false);
  }, [onImport, entityName]);

  const handleDownloadTemplate = useCallback(() => {
    if (onDownloadTemplate) {
      onDownloadTemplate();
    } else {
      toast.info(`Download ${entityName} template - Coming soon`);
    }
    setImportDropdownOpen(false);
  }, [onDownloadTemplate, entityName]);

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport();
    } else {
      toast.info(`Export ${entityName} to XLSX - Coming soon`);
    }
  }, [onExport, entityName]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // CTRL+I for import
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i' && importEnabled) {
        e.preventDefault();
        setImportDropdownOpen(true);
        return;
      }

      // CTRL+E for export
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && exportEnabled) {
        e.preventDefault();
        handleExport();
        return;
      }

      // When import dropdown is open, handle 1 and 2 keys
      if (importDropdownOpen) {
        if (e.key === '1') {
          e.preventDefault();
          handleDownloadTemplate();
        } else if (e.key === '2') {
          e.preventDefault();
          handleUploadClick();
        } else if (e.key === 'Escape') {
          setImportDropdownOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importEnabled, exportEnabled, importDropdownOpen, handleExport, handleDownloadTemplate, handleUploadClick]);

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
        <DropdownMenu open={importDropdownOpen} onOpenChange={setImportDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import
              <Kbd>⌘I</Kbd>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadTemplate}>
              <FileDown className="w-4 h-4 mr-2" />
              Download Template
              <Kbd className="ml-auto">1</Kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUploadClick}>
              <FileUp className="w-4 h-4 mr-2" />
              Upload File
              <Kbd className="ml-auto">2</Kbd>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {exportEnabled && (
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
          <Kbd>⌘E</Kbd>
        </Button>
      )}
    </>
  );
};