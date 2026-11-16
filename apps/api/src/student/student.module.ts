import { Module } from '@nestjs/common';
import { PolicyModule } from '../policy/policy.module';
import { AcademicRepository } from './repositories/academic.repository';
import { ScheduleRepository } from './repositories/schedule.repository';
import { StudentRepository } from './repositories/student.repository';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

@Module({
  imports: [PolicyModule],
  controllers: [StudentController],
  providers: [
    StudentService,
    StudentRepository,
    AcademicRepository,
    ScheduleRepository,
  ],
})
export class StudentModule {}
