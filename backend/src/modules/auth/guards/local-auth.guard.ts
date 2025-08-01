import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  private readonly logger = new Logger(LocalAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    this.logger.debug(`Local authentication attempt for: ${request.body?.email}`);
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    if (err || !user) {
      this.logger.warn(`Local authentication failed for ${request.body?.email}: ${info?.message || err?.message}`);
      throw err || new Error('Local authentication failed');
    }

    this.logger.debug(`Local authentication successful for: ${user.email}`);
    return user;
  }
}