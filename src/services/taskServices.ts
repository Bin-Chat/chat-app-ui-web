import authorizedAxios from '@/utils/authorizedAxios';
import type {
  Task,
  TaskStats,
  CreateTaskPayload,
  UpdateTaskPayload,
} from '@/types/task.type';

export const taskServices = {
  createTask: (conversationId: string, payload: CreateTaskPayload) =>
    authorizedAxios
      .post<Task>(`/api/chat/conversations/${conversationId}/tasks`, payload)
      .then((r) => r.data),

  getTasks: (conversationId: string, status?: string, scope?: string) =>
    authorizedAxios
      .get<Task[]>(`/api/chat/conversations/${conversationId}/tasks`, {
        params: { status, scope },
      })
      .then((r) => r.data),

  getStats: (conversationId: string) =>
    authorizedAxios
      .get<TaskStats>(`/api/chat/conversations/${conversationId}/tasks/stats`)
      .then((r) => r.data),

  updateTask: (taskId: string, payload: UpdateTaskPayload) =>
    authorizedAxios.patch<Task>(`/api/chat/tasks/${taskId}`, payload).then((r) => r.data),

  completeTask: (taskId: string) =>
    authorizedAxios.post<Task>(`/api/chat/tasks/${taskId}/complete`).then((r) => r.data),

  deleteTask: (taskId: string) =>
    authorizedAxios.delete(`/api/chat/tasks/${taskId}`).then((r) => r.data),

  addComment: (taskId: string, content: string) =>
    authorizedAxios
      .post<Task>(`/api/chat/tasks/${taskId}/comments`, { content })
      .then((r) => r.data),
};
