import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useAppSelector } from '@/hooks/useRedux';

import { AppInitializer } from './providers/AppInitializer';
import { FriendSocketInitializer } from './providers/FriendSocketInitializer';
import { ChatSocketInitializer } from './providers/ChatSocketInitializer';
import ProtectedRoute from './routes/ProtectedRoute';
import AuthRoute from './routes/AuthRoute';
import ChatPage from '@/pages/private/chat/ChatPage';
import IncomingCallModal from './components/call/IncomingCallModal';
import CallRoom from './components/call/CallRoom';

// Layouts
import EmptyLayout from '@/layouts/EmptyLayout';
import DefaultLayout from '@/layouts/DefaultLayout';

// Pages
import { UserRole } from '@/types/user.type';
import Login from '@/pages/auth/Login/Login';
import Register from '@/pages/auth/Register/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword/ForgotPassword';
import VerifyEmail from '@/pages/auth/VerifyEmail/VerifyEmail';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import NotFound from '@/pages/public/NotFound';
import JoinGroup from '@/pages/public/JoinGroup';
import ContactsPage from '@/pages/private/contacts';
import SettingsPage from '@/pages/private/settings';

const router = createBrowserRouter([
  // ─── Protected routes (phải đăng nhập) ───
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        path: '',
        element: <DefaultLayout />,
        children: [
          {
            index: true,
            element: <ChatPage />,
          },
          {
            path: 'chat/:conversationId',
            element: <ChatPage />,
          },
          {
            path: 'contacts',
            element: <ContactsPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
          {
            path: 'join/:token',
            element: <JoinGroup />,
          },
        ],
      },
    ],
  },

  // ─── Auth routes (chuyển hướng nếu đã đăng nhập) ───
  {
    path: '/login',
    element: (
      <AuthRoute>
        <EmptyLayout />
      </AuthRoute>
    ),
    children: [{ index: true, element: <Login /> }],
  },
  {
    path: '/register',
    element: (
      <AuthRoute>
        <EmptyLayout />
      </AuthRoute>
    ),
    children: [{ index: true, element: <Register /> }],
  },
  {
    path: '/forgot-password',
    element: <EmptyLayout />,
    children: [{ index: true, element: <ForgotPassword /> }],
  },
  {
    path: '/verify-email',
    element: <EmptyLayout />,
    children: [{ index: true, element: <VerifyEmail /> }],
  },

  // ─── Admin routes (phải là Admin) ───
  {
    path: '/admin',
    element: <ProtectedRoute role={UserRole.ADMIN} />,
    children: [
      {
        path: '',
        element: <EmptyLayout />,
        children: [{ index: true, element: <AdminDashboard /> }],
      },
    ],
  },

  // ─── 404 ───
  {
    path: '*',
    element: <EmptyLayout />,
    children: [{ path: '*', element: <NotFound /> }],
  },
]);

function App() {
  const callStatus = useAppSelector((s: any) => s.call?.status ?? 'idle');

  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <>
        <AppInitializer />
        <FriendSocketInitializer />
        <ChatSocketInitializer />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss={false}
          pauseOnHover
          theme="light"
        />
        <RouterProvider router={router} />
        {/* Call overlays — render on top of everything */}
        <IncomingCallModal />
        {callStatus !== 'idle' && <CallRoom />}
      </>
    </TooltipPrimitive.Provider>
  );
}

export default App;

// ─── Protected routes (phải đăng nhập) ───
