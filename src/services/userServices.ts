import authorizedAxios from '@/utils/authorizedAxios';

export interface UserProfile {
  id: string;
  fullName: string;
  avatar?: string | null;
}

export const userServices = {
  getUsersByIds: (userIds: string[]) =>
    authorizedAxios.post<UserProfile[]>('/api/users/batch', { userIds }).then((r) => r.data),
};
