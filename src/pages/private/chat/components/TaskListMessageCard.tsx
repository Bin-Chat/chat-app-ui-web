import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Square, Clock, User } from 'lucide-react';
import { taskServices } from '@/services/taskServices';
import type { Task } from '@/types/task.type';

export interface TaskListMeta {
  type: 'task_list_created';
  batchId: string;
  actorName: string;
  createdBy: string;
  tasks: Array<{
    taskId: string;
    title: string;
    assigneeId?: string | null;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string | null;
  }>;
}

interface Props {
  metadata: TaskListMeta;
  currentUserId: string;
  conversationId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export default function TaskListMessageCard({
  metadata,
  currentUserId,
  conversationId,
}: Props) {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const list = await taskServices.getTasks(conversationId);
      const map: Record<string, Task> = {};
      for (const t of list) {
        if (metadata.tasks.some((m) => m.taskId === t._id)) {
          map[t._id] = t;
        }
      }
      setTasks(map);
    } catch {
      /* ignore */
    }
  }, [conversationId, metadata.batchId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const handler = () => loadTasks();
    window.addEventListener('task:updated', handler);
    window.addEventListener('task:created', handler);
    window.addEventListener('task:completed', handler);
    window.addEventListener('task:deleted', handler);
    return () => {
      window.removeEventListener('task:updated', handler);
      window.removeEventListener('task:created', handler);
      window.removeEventListener('task:completed', handler);
      window.removeEventListener('task:deleted', handler);
    };
  }, [loadTasks]);

  const handleToggle = async (taskId: string, current: Task | undefined) => {
    if (busy === taskId) return;
    setBusy(taskId);
    try {
      const updated =
        current?.status === 'done'
          ? await taskServices.updateTask(taskId, { status: 'todo' })
          : await taskServices.completeTask(taskId);
      setTasks((p) => ({ ...p, [taskId]: updated }));
      window.dispatchEvent(new CustomEvent('task:updated', { detail: { task: updated } }));
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  const doneCount = Object.values(tasks).filter((t) => t.status === 'done').length;
  const total = metadata.tasks.length;

  return (
    <div className="my-2 flex w-full justify-center">
      <div className="w-full max-w-md rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-teal-950/40">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500 p-1.5 text-white">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Danh sách công việc
              </div>
              <div className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
                {metadata.actorName} đã tạo • {doneCount}/{total} hoàn thành
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {metadata.tasks.map((m) => {
            const t = tasks[m.taskId];
            const done = t?.status === 'done';
            const isMine = (t?.assigneeId ?? m.assigneeId) === currentUserId;
            return (
              <div
                key={m.taskId}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${
                  done
                    ? 'bg-emerald-100/50 dark:bg-emerald-900/30'
                    : 'bg-white/60 hover:bg-white dark:bg-gray-800/40 dark:hover:bg-gray-800/70'
                }`}
              >
                <button
                  onClick={() => handleToggle(m.taskId, t)}
                  disabled={busy === m.taskId || (!isMine && t?.createdBy !== currentUserId)}
                  className="mt-0.5 shrink-0 text-emerald-600 disabled:opacity-50 dark:text-emerald-400"
                  title={isMine ? 'Đánh dấu hoàn thành' : 'Chỉ người được giao mới đổi trạng thái'}
                >
                  {done ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm ${
                      done
                        ? 'line-through text-gray-500 dark:text-gray-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t?.title ?? m.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {(t?.priority ?? m.priority) && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-medium ${
                          PRIORITY_COLORS[t?.priority ?? m.priority ?? 'medium']
                        }`}
                      >
                        {(t?.priority ?? m.priority) === 'high'
                          ? 'Cao'
                          : (t?.priority ?? m.priority) === 'low'
                            ? 'Thấp'
                            : 'Vừa'}
                      </span>
                    )}
                    {(t?.assigneeId ?? m.assigneeId) && (
                      <span className="flex items-center gap-0.5 text-gray-600 dark:text-gray-400">
                        <User className="h-3 w-3" />
                        {isMine ? 'Bạn' : (t?.assigneeId ?? m.assigneeId)?.slice(-6)}
                      </span>
                    )}
                    {(t?.dueDate ?? m.dueDate) && (
                      <span className="flex items-center gap-0.5 text-gray-600 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {new Date(t?.dueDate ?? m.dueDate!).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
