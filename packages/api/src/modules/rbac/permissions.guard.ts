import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './rbac.constants';
import { RbacService } from './rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const legacyRole = request.user?.role;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    // Legacy fallback: ADMIN users pass all permission checks until RBAC is seeded
    if (legacyRole === 'ADMIN') {
      return true;
    }

    const hasPermission = await this.rbacService.hasAnyPermission(userId, requiredPermissions);

    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
