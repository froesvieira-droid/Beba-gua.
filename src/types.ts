export type Gender = 'masculino' | 'feminino';

export interface UserProfile {
  weight: number; // kg
  height: number; // cm
  gender: Gender;
  dailyGoal: number; // ml
  reminderInterval: number; // minutes
  wakeTime: string; // HH:mm
  sleepTime: string; // HH:mm
  customReminderTimes: string[]; // ["HH:mm", ...]
}

export interface WaterLog {
  id: string;
  amount: number; // ml
  timestamp: number;
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  logs: WaterLog[];
  goal: number;
}
