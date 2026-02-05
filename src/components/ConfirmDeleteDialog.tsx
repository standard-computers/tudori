 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 
 interface ConfirmDeleteDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   title?: string;
   description?: string;
   onConfirm: () => void;
   isBlocked?: boolean;
   blockedReason?: string;
 }
 
 export function ConfirmDeleteDialog({
   open,
   onOpenChange,
   title = 'Delete Record',
   description = 'Are you sure you want to delete this record? This action cannot be undone.',
   onConfirm,
   isBlocked = false,
   blockedReason,
 }: ConfirmDeleteDialogProps) {
   return (
     <AlertDialog open={open} onOpenChange={onOpenChange}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle>{isBlocked ? 'Cannot Delete' : title}</AlertDialogTitle>
           <AlertDialogDescription>
             {isBlocked ? blockedReason : description}
           </AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           {isBlocked ? (
             <AlertDialogAction onClick={() => onOpenChange(false)}>
               OK
             </AlertDialogAction>
           ) : (
             <>
               <AlertDialogCancel>Cancel</AlertDialogCancel>
               <AlertDialogAction
                 onClick={onConfirm}
                 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
               >
                 Delete
               </AlertDialogAction>
             </>
           )}
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
   );
 }