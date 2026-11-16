export interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'CANCELLED' | 'CHANGED';
}

export interface ScheduledOccurrence<T extends ScheduleItem> {
  date: string;
  lesson: T;
}

export interface FreeWindow {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export class ScheduleService {
  forDay<T extends ScheduleItem>(
    entries: readonly T[],
    date: string,
  ): T[] {
    const day = this.parseDate(date);
    const dayOfWeek = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    return entries
      .filter((entry) => entry.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  forWeek<T extends ScheduleItem>(
    entries: readonly T[],
    date: string,
  ): ScheduledOccurrence<T>[] {
    const selectedDate = this.parseDate(date);
    const monday = new Date(selectedDate);
    const weekday = monday.getUTCDay() === 0 ? 7 : monday.getUTCDay();
    monday.setUTCDate(monday.getUTCDate() - weekday + 1);
    const occurrences: ScheduledOccurrence<T>[] = [];

    for (let offset = 0; offset < 7; offset += 1) {
      const current = new Date(monday);
      current.setUTCDate(monday.getUTCDate() + offset);
      const dayOfWeek = current.getUTCDay() === 0 ? 7 : current.getUTCDay();
      const dayEntries = entries
        .filter((entry) => entry.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (const lesson of dayEntries) {
        occurrences.push({ date: current.toISOString().slice(0, 10), lesson });
      }
    }
    return occurrences;
  }

  between<T extends ScheduleItem>(
    entries: readonly T[],
    from: string,
    to: string,
  ): ScheduledOccurrence<T>[] {
    const start = this.parseDate(from);
    const end = this.parseDate(to);
    if (start > end) {
      throw new RangeError('The from date must not be after the to date');
    }
    const occurrences: ScheduledOccurrence<T>[] = [];
    for (
      const current = new Date(start);
      current <= end;
      current.setUTCDate(current.getUTCDate() + 1)
    ) {
      const date = current.toISOString().slice(0, 10);
      for (const lesson of this.forDay(entries, date)) {
        occurrences.push({ date, lesson });
      }
    }
    return occurrences;
  }

  freeWindows<T extends ScheduleItem>(lessons: readonly T[]): FreeWindow[] {
    const sorted = lessons
      .filter((lesson) => lesson.status !== 'CANCELLED')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (sorted.length < 2) {
      return [];
    }
    const windows: FreeWindow[] = [];
    let occupiedUntil = sorted[0].endTime;
    for (let index = 1; index < sorted.length; index += 1) {
      const startTime = occupiedUntil;
      const endTime = sorted[index].startTime;
      const durationMinutes =
        this.toMinutes(endTime) - this.toMinutes(startTime);
      if (durationMinutes > 0) {
        windows.push({ startTime, endTime, durationMinutes });
      }
      if (sorted[index].endTime > occupiedUntil) {
        occupiedUntil = sorted[index].endTime;
      }
    }
    return windows;
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new RangeError('A valid ISO date is required');
    }
    return date;
  }

  private toMinutes(value: string): number {
    const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  }
}
