import { LockKeyhole, LogIn, ShieldAlert } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { clearSessionNotice } from '@/store/slices';

export default function SessionTerminationModal() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector((state) => state.auth.sessionNotice);

  if (!notice) return null;

  const isLocked = notice.reasonCode === 'account_locked';
  const close = () => {
    dispatch(clearSessionNotice());
    window.location.assign('/login');
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25">
        <div
          className={`px-6 py-7 ${isLocked ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-blue-600 to-indigo-700'}`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25">
            {isLocked ? <LockKeyhole className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            BinChat Security
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">
            {isLocked ? 'Tài khoản đã bị khóa' : 'Phiên đăng nhập đã kết thúc'}
          </h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm leading-6 text-slate-600">{notice.message}</p>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            {isLocked
              ? 'Bạn không thể tiếp tục sử dụng hệ thống cho đến khi quản trị viên mở khóa tài khoản.'
              : 'Đây là biện pháp bảo vệ tài khoản. Hãy đăng nhập lại nếu bạn vẫn được phép truy cập.'}
          </div>
          <button
            onClick={close}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <LogIn className="h-4 w-4" />
            Về trang đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}
