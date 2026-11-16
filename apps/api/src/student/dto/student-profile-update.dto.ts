import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class StudentProfileUpdateDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 'https://cdn.campus.kz/students/profile.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  photoUrl?: string | null;
}
