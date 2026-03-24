import { Outlet } from 'react-router-dom';
import { useScrollToTop } from '@/hooks/useScrollToTop';

export default function AdminLayout() {
  useScrollToTop();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <main className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-background via-background/98 to-accent/5 p-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
