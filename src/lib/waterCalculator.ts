import { Gender } from '../types';

/**
 * Calculates the daily water goal in ml.
 * Base formula: 35ml per kg of body weight.
 * Adjustments:
 * - Men: +10%
 * - Women: Base
 * - Height: +5ml for every 10cm above 160cm
 */
export function calculateDailyGoal(weight: number, height: number, gender: Gender): number {
  let goal = weight * 35;

  if (gender === 'masculino') {
    goal *= 1.1;
  }

  if (height > 160) {
    goal += (height - 160) * 0.5;
  }

  // Round to nearest 50ml
  return Math.round(goal / 50) * 50;
}

/**
 * Calculates the recommended amount per reminder.
 */
export function calculateGlassSize(dailyGoal: number, wakeTime: string, sleepTime: string, interval: number): number {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  const [sleepH, sleepM] = sleepTime.split(':').map(Number);

  let wakingMinutes = (sleepH * 60 + sleepM) - (wakeH * 60 + wakeM);
  if (wakingMinutes < 0) wakingMinutes += 24 * 60; // Handle overnight

  const remindersCount = Math.floor(wakingMinutes / interval);
  if (remindersCount <= 0) return 250; // Fallback

  const size = dailyGoal / remindersCount;
  return Math.round(size / 10) * 10;
}
