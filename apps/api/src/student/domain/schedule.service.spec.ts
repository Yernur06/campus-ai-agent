import { ScheduleItem, ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  const schedule = new ScheduleService();
  const lessons: ScheduleItem[] = [
    {
      id: 'monday',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      status: 'ACTIVE',
    },
    {
      id: 'tuesday',
      dayOfWeek: 2,
      startTime: '11:00',
      endTime: '12:00',
      status: 'ACTIVE',
    },
    {
      id: 'cancelled',
      dayOfWeek: 1,
      startTime: '10:30',
      endTime: '11:00',
      status: 'CANCELLED',
    },
    {
      id: 'monday-late',
      dayOfWeek: 1,
      startTime: '12:00',
      endTime: '13:00',
      status: 'CHANGED',
    },
  ];

  it('selects the right weekday and expands a week into dated occurrences', () => {
    expect(schedule.forDay(lessons, '2026-11-16').map(({ id }) => id)).toEqual([
      'monday',
      'cancelled',
      'monday-late',
    ]);
    expect(schedule.forWeek(lessons, '2026-11-18')).toHaveLength(4);
  });

  it('calculates free windows and does not treat cancelled lessons as occupied', () => {
    expect(schedule.freeWindows(schedule.forDay(lessons, '2026-11-16'))).toEqual([
      { startTime: '10:00', endTime: '12:00', durationMinutes: 120 },
    ]);
  });
});
