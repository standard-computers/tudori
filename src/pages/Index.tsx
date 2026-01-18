import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction } from '@/contexts/StatusBarContext';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  useTransaction('init');

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/auth');
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
};

export default Index;
