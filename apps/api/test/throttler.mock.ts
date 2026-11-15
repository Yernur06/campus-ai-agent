import { CanActivate, DynamicModule, ExecutionContext } from '@nestjs/common';

export class ThrottlerGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

export class ThrottlerModule {
  static forRoot(_options: unknown): DynamicModule {
    return { module: ThrottlerModule };
  }
}

export function Throttle(_options: unknown): MethodDecorator {
  return () => undefined;
}
