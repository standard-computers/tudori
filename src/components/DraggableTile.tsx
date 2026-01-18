import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DraggableTileProps {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
  path: string | null;
  index: number;
  openInNewTab?: boolean;
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
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${index * 50}ms`,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.9 : 1,
  };

  const handleClick = () => {
    if (path) {
      if (openInNewTab) {
        window.open(path, '_blank');
      } else {
        navigate(path);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`app-tile animate-slide-up ${isDragging ? 'shadow-2xl scale-105' : ''}`}
      {...attributes}
      {...listeners}
      onClick={handleClick}
    >
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-display font-semibold text-foreground mb-1">{name}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
};