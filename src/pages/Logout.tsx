import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Logout = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      await signOut();
      navigate('/auth', { replace: true });
    };

    performLogout();
  }, [signOut, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Signing you out...</p>
      </div>
    </div>
  );
};

export default Logout;
