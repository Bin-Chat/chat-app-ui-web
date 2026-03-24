import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Users, Settings, LogOut } from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { logoutUser } from '@/store/slices';

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: MessageCircle, label: 'Tin nhắn', to: '/' },
  { icon: Users, label: 'Danh bạ', to: '/contacts' },
];

// ─── NavButton ────────────────────────────────────────────────────────────────
function NavButton({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof MessageCircle;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      to={to}
      end
      title={label}
      className={({ isActive }) =>
        `w-full flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-150 select-none
                ${
                  isActive
                    ? 'bg-[#EBF3FF] text-[#0068FF]'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
          <span className="text-[10px] font-medium leading-none">{label}</span>
        </>
      )}
    </NavLink>
  );
}

// ─── DefaultLayout ────────────────────────────────────────────────────────────
const DefaultLayout = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const handleLogout = async () => {
    setShowConfirm(false);
    try {
      await dispatch(logoutUser()).unwrap();
    } catch {
      // kể cả khi API lỗi vẫn redirect
    }
    toast.success('Đã đăng xuất');
    navigate('/login', { replace: true });
  };

  const avatarLetter = user?.fullName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F2F5]">
      {/* ─── Left icon sidebar ──────────────────────────────────── */}
      <aside className="w-[68px] h-full bg-white border-r border-gray-100 flex flex-col items-center py-4 flex-shrink-0 z-10">
        {/* Logo */}
        <div className="w-11 h-11 bg-[#0068FF] rounded-[14px] flex items-center justify-center mb-5 shadow-[0_4px_12px_rgba(0,104,255,0.3)] flex-shrink-0">
          <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.to} {...item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-2 w-full px-2">
          {/* Settings */}
          <NavButton icon={Settings} label="Cài đặt" to="/settings" />

          <div className="w-8 h-px bg-gray-150 my-1" />

          {/* User avatar */}
          <button
            title={user?.fullName ?? 'Hồ sơ'}
            className="w-9 h-9 rounded-full bg-[#0068FF] flex items-center justify-center
                            hover:ring-2 hover:ring-[#0068FF]/40 transition-all overflow-hidden flex-shrink-0"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-sm font-bold leading-none">{avatarLetter}</span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={() => setShowConfirm(true)}
            title="Đăng xuất"
            className="w-full flex flex-col items-center gap-1 py-2 rounded-xl
                            text-gray-400 hover:bg-red-50 hover:text-red-500
                            transition-all duration-150 select-none"
          >
            <LogOut className="w-[20px] h-[20px]" strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-none">Thoát</span>
          </button>
        </div>
      </aside>

      {/* ─── Main area ──────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex overflow-hidden">
        <Outlet />
      </main>

      {/* ─── Logout confirm dialog ──────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
              onClick={() => setShowConfirm(false)}
            />

            {/* Dialog – wrapper div giữ centering, motion.div chỉ lo animation */}
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="pointer-events-auto w-[340px] bg-white rounded-2xl
                                    shadow-[0_24px_64px_rgba(0,0,0,0.14)] p-6"
              >
                {/* Icon */}
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-6 h-6 text-red-500" strokeWidth={2} />
                </div>

                <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1.5">
                  Đăng xuất khỏi Bin Chat?
                </h3>
                <p className="text-[13px] text-gray-500 text-center mb-6 leading-relaxed">
                  Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px]
                                        font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl
                                        text-[13px] font-medium text-white transition-colors
                                        shadow-[0_4px_12px_rgba(239,68,68,0.25)]"
                  >
                    Đăng xuất
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DefaultLayout;
