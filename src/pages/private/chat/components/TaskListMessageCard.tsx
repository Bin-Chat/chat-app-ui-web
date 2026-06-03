import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Clock, PlayCircle, RotateCcw, Square, User } from 'lucide-react';
import { taskServices } from '@/services/taskServices';
import { userServices } from '@/services/userServices';
import type { Task, TaskStatus } from '@/types/task.type';

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
    status?: TaskStatus;
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
  low: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  done: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

function formatDueDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TaskListMessageCard({
  metadata,
  currentUserId,
  conversationId,
}: Props) {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

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
    const ids = Array.from(
      new Set(
        [
          ...Object.values(tasks).map((task) => task.assigneeId),
          ...Object.values(tasks).map((task) => task.createdBy),
          ...metadata.tasks.map((task) => task.assigneeId),
          metadata.createdBy,
        ].filter((id): id is string => Boolean(id && id !== 'binchat-ai-bot'))
      )
    );
    if (ids.length === 0) return;
    let cancelled = false;
    userServices
      .getUsersByIds(ids)
      .then((users) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const user of users) map[user.id] = user.fullName;
        setMemberNames(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [metadata.tasks, tasks]);

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

  const handleStatusChange = async (
    taskId: string,
    current: Task | undefined,
    nextStatus: TaskStatus
  ) => {
    if (busy === taskId) return;
    setBusy(taskId);
    try {
      const updated =
        nextStatus === 'done'
          ? await taskServices.completeTask(taskId)
          : await taskServices.updateTask(taskId, { status: nextStatus });
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
      <div className="w-full max-w-md rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50 to-sky-50 p-4 shadow-sm dark:border-blue-800/40 dark:from-blue-950/40 dark:to-sky-950/40">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500 p-1.5 text-white">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Danh sách công việc
              </div>
              <div className="text-xs text-blue-700/70 dark:text-blue-300/70">
                {metadata.actorName} đã tạo • {doneCount}/{total} hoàn thành
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {metadata.tasks.map((m) => {
            const t = tasks[m.taskId];
            const done = t?.status === 'done';
            const status = t?.status ?? m.status ?? 'todo';
            const assigneeId = t?.assigneeId ?? m.assigneeId ?? null;
            const creatorId = t?.createdBy ?? metadata.createdBy ?? null;
            const isMine = assigneeId === currentUserId;
            const assigneeName = assigneeId
              ? isMine
                ? 'Bạn'
                : (memberNames[assigneeId] ?? `User ${assigneeId.slice(-6)}`)
              : null;
            const creatorName = creatorId
              ? creatorId === currentUserId
                ? 'Bạn'
                : (memberNames[creatorId] ?? `User ${creatorId.slice(-6)}`)
              : null;
            const canChange = isMine || creatorId === currentUserId;
            return (
              <div
                key={m.taskId}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${
                  done
                    ? 'bg-blue-100/50 dark:bg-blue-900/30'
                    : 'bg-white/60 hover:bg-white dark:bg-gray-800/40 dark:hover:bg-gray-800/70'
                }`}
              >
                <button
                  onClick={() =>
                    handleStatusChange(
                      m.taskId,
                      t,
                      status === 'todo' ? 'in_progress' : status === 'in_progress' ? 'done' : 'todo'
                    )
                  }
                  disabled={busy === m.taskId || !canChange}
                  className="mt-0.5 shrink-0 text-blue-600 disabled:opacity-50 dark:text-blue-400"
                  title={
                    canChange
                      ? status === 'todo'
                        ? 'Bắt đầu làm'
                        : status === 'in_progress'
                          ? 'Đánh dấu hoàn thành'
                          : 'Mở lại công việc'
                      : 'Chỉ người được giao hoặc người tạo mới đổi trạng thái'
                  }
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
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-medium ${STATUS_COLORS[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
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
                    {assigneeName && (
                      <span className="flex items-center gap-0.5 text-gray-600 dark:text-gray-400">
                        <User className="h-3 w-3" />
                        Làm: {assigneeName}
                      </span>
                    )}
                    {creatorName && (
                      <span className="flex items-center gap-0.5 text-gray-600 dark:text-gray-400">
                        <User className="h-3 w-3" />
                        Giao: {creatorName}
                      </span>
                    )}
                    {(t?.dueDate ?? m.dueDate) && (
                      <span className="flex items-center gap-0.5 text-gray-600 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatDueDate(t?.dueDate ?? m.dueDate!)}
                      </span>
                    )}
                  </div>
                  {canChange && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {status === 'todo' ? (
                        <button
                          type="button"
                          disabled={busy === m.taskId}
                          onClick={() => handleStatusChange(m.taskId, t, 'in_progress')}
                          className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          <PlayCircle className="h-3 w-3" />
                          Bắt đầu
                        </button>
                      ) : status === 'in_progress' ? (
                        <button
                          type="button"
                          disabled={busy === m.taskId}
                          onClick={() => handleStatusChange(m.taskId, t, 'done')}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <CheckSquare className="h-3 w-3" />
                          Hoàn thành
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === m.taskId}
                          onClick={() => handleStatusChange(m.taskId, t, 'todo')}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Mở lại
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
