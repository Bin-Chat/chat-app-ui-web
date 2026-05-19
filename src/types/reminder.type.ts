export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface ReminderRsvp {
  userId: string;
  name: string;
  status: 'yes' | 'no';
}

export interface Reminder {
  _id: string;
  conversationId: string;
  createdBy: string;
  content: string;
  remindAt: string; // ISO date string
  repeat: RepeatType;
  isCompleted: boolean;
  lastFiredAt: string | null;
  rsvps: ReminderRsvp[];
  createdAt: string;
  updatedAt: string;
}
