import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Check API health' })
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
