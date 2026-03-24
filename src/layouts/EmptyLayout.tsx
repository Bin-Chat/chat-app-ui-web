import { Outlet } from 'react-router-dom';
import { useScrollToTop } from '@/hooks/useScrollToTop';

const EmptyLayout = () => {
  useScrollToTop();

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
};

export default EmptyLayout;
