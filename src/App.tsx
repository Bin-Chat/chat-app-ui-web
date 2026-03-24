import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { MessageCircle } from 'lucide-react';

import { AppInitializer } from './providers/AppInitializer';
import ProtectedRoute from './routes/ProtectedRoute';
import AuthRoute from './routes/AuthRoute';

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

// Empty state khi chưa chọn cuộc trò chuyện
function ChatWelcome() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] select-none">
      <div className="w-20 h-20 bg-[#0068FF]/10 rounded-full flex items-center justify-center mb-5">
        <MessageCircle className="w-10 h-10 text-[#0068FF]/60" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-gray-700 mb-1">Chào mừng đến Bin Chat</p>
      <p className="text-[13px] text-gray-400">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
    </div>
  );
}

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
            element: <ChatWelcome />,
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
  return (
    <>
      <AppInitializer />
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
    </>
  );
}

export default App;
