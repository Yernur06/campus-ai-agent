import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class StudentScheduleQueryDto {
  @ApiProperty({ example: '2026-11-16' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-11-22' })
  @IsDateString()
  to!: string;
}

export class StudentDateQueryDto {
  @ApiProperty({ example: '2026-11-16' })
  @IsDateString()
  date!: string;
}

export class StudentGradesQueryDto {
  @ApiPropertyOptional({ example: 'b6f52bd8-52b1-4d4a-a251-49dc7938197a' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;
}
