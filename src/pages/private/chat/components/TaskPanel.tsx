import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Plus,
  CheckSquare,
  Square,
  Clock,
  User,
  Trash2,
  Pencil,
} from 'lucide-react';
import { taskServices } from '@/services/taskServices';
import type { Task, TaskStatus } from '@/types/task.type';
import type { Participant } from '@/types/chat.type';
import CreateTaskModal from './CreateTaskModal';

interface Props {
  conversationId: string;
  currentUserId: string;
  members: Participant[];
  isAdmin?: boolean;
  onClose: () => void;
}

const STATUS_TABS: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'todo', label: 'Cần làm' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'done', label: 'Hoàn thành' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export default function TaskPanel({
  conversationId,
  currentUserId,
  members,
  isAdmin,
  onClose,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | TaskStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskServices.getTasks(conversationId);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpsert = (e: Event) => {
      const t: Task | undefined = (e as CustomEvent).detail?.task;
      if (!t || t.conversationId !== conversationId) return;
      setTasks((prev) => {
        const idx = prev.findIndex((x) => x._id === t._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = t;
          return next;
        }
        return [t, ...prev];
      });
    };
    const onDeleted = (e: Event) => {
      const { taskId } = (e as CustomEvent).detail ?? {};
      if (taskId) setTasks((prev) => prev.filter((x) => x._id !== taskId));
    };
    const onBatch = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      if (Array.isArray(detail.tasks)) load();
    };
    window.addEventListener('task:updated', onUpsert);
    window.addEventListener('task:created', onUpsert);
    window.addEventListener('task:completed', onUpsert);
    window.addEventListener('task:deleted', onDeleted);
    window.addEventListener('task:batch_created', onBatch);
    return () => {
      window.removeEventListener('task:updated', onUpsert);
      window.removeEventListener('task:created', onUpsert);
      window.removeEventListener('task:completed', onUpsert);
      window.removeEventListener('task:deleted', onDeleted);
      window.removeEventListener('task:batch_created', onBatch);
    };
  }, [conversationId, load]);

  const filtered = useMemo(() => {
    const list = tab === 'all' ? tasks : tasks.filter((t) => t.status === tab);
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, tab]);

  const handleToggle = async (task: Task) => {
    try {
      const updated =
        task.status === 'done'
          ? await taskServices.updateTask(task._id, { status: 'todo' })
          : await taskServices.completeTask(task._id);
      setTasks((p) => p.map((t) => (t._id === updated._id ? updated : t)));
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Xóa công việc "${task.title}"?`)) return;
    try {
      await taskServices.deleteTask(task._id);
      setTasks((p) => p.filter((t) => t._id !== task._id));
    } catch {
      /* ignore */
    }
  };

  const handleSaved = (task: Task) => {
    setTasks((prev) => {
      const idx = prev.findIndex((x) => x._id === task._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = task;
        return next;
      }
      return [task, ...prev];
    });
  };

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks]
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500 p-1.5 text-white">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Công việc nhóm
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {counts.done}/{counts.all} hoàn thành
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setShowCreate(true);
              }}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo mới
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 px-4 dark:border-gray-700">
          {STATUS_TABS.map((s) => (
            <button
              key={s.value}
              onClick={() => setTab(s.value)}
              className={`relative px-3 py-2 text-xs font-medium transition ${
                tab === s.value
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {s.label} ({counts[s.value]})
              {tab === s.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Chưa có công việc nào
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((task) => {
                const isMine = task.assigneeId === currentUserId;
                const canEdit =
                  task.createdBy === currentUserId || isMine || isAdmin;
                const canDelete = task.createdBy === currentUserId || isAdmin;
                const overdue =
                  task.dueDate &&
                  task.status !== 'done' &&
                  new Date(task.dueDate) < new Date();

                return (
                  <li
                    key={task._id}
                    className={`group rounded-lg border p-3 transition ${
                      task.status === 'done'
                        ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30'
                        : overdue
                          ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20'
                          : 'border-gray-200 bg-white hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggle(task)}
                        disabled={!isMine && task.createdBy !== currentUserId && !isAdmin}
                        className="mt-0.5 shrink-0 text-emerald-600 disabled:opacity-30 dark:text-emerald-400"
                      >
                        {task.status === 'done' ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            task.status === 'done'
                              ? 'text-gray-500 line-through dark:text-gray-400'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                            {task.description}
                          </div>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${PRIORITY_COLORS[task.priority]}`}
                          >
                            {task.priority === 'high'
                              ? '● Cao'
                              : task.priority === 'low'
                                ? '● Thấp'
                                : '● Vừa'}
                          </span>
                          {task.assigneeId && (
                            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <User className="h-3 w-3" />
                              {isMine ? 'Bạn' : task.assigneeId.slice(-6)}
                            </span>
                          )}
                          {task.dueDate && (
                            <span
                              className={`flex items-center gap-1 ${
                                overdue
                                  ? 'font-medium text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {overdue && ' (Quá hạn)'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditing(task);
                              setShowCreate(true);
                            }}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Sửa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(task)}
                            className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          conversationId={conversationId}
          members={members}
          initial={editing}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
