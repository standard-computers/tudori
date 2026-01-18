import { toast as sonnerToast } from 'sonner';

// Re-export toast with status bar integration
// This allows gradual migration - toast still works normally
// but can be enhanced to also show in status bar
export const toast = sonnerToast;
