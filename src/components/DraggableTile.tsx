import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface DraggableTileProps {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
  path: string | null;
  index: number;
  openInNewTab?: boolean;
  onCustomClick?: () => void;
}

export const DraggableTile = ({ 
  id, 
  name, 
  icon: Icon, 
  color, 
  description, 
  path, 
  index,
  openInNewTab = false,
  onCustomClick,
}: DraggableTileProps) => {
  const navigate = useNavigate();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto' as const,
  };

  const handleClick = () => {
    if (onCustomClick) {
      onCustomClick();
      return;
    }
    if (path) {
      if (openInNewTab) {
        window.open(path, '_blank');
      } else {
        navigate(path);
      }
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`app-tile ${isDragging ? 'shadow-2xl' : ''}`}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{
        opacity: isDragging ? 0.85 : 1,
        y: 0,
        scale: isDragging ? 1.05 : 1,
        boxShadow: isDragging
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay: isDragging ? 0 : index * 0.04,
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center w-full gap-3">
        <Icon className={`w-8 h-8 ${color} shrink-0`} />
        <div className="flex flex-col min-w-0">
          <h3 className="font-display font-semibold text-foreground mb-1 text-left truncate">{name}</h3>
          <p className="text-sm text-muted-foreground text-left truncate">{description}</p>
        </div>
      </div>
    </motion.div>
  );
};
