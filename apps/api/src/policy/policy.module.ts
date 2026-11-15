import { Module } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { StudentScopeGuard } from './student-scope';

@Module({
  providers: [PolicyService, StudentScopeGuard],
  exports: [PolicyService, StudentScopeGuard],
})
export class PolicyModule {}
