import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SCHEDULE_INCLUDE = {
  course: { include: { subject: true } },
  classroom: true,
  teacher: true,
} satisfies Prisma.ScheduleEntryInclude;

export type ScheduleRecord = Prisma.ScheduleEntryGetPayload<{
  include: typeof SCHEDULE_INCLUDE;
}>;

@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByGroup(groupId: string): Promise<ScheduleRecord[]> {
    return this.prisma.scheduleEntry.findMany({
      where: { groupId },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }
}
