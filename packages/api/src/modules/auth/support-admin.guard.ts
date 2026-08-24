import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class SupportAdminGuard implements CanActivate {
  /** Roles that qualify as "support admin" in legacy equality checks. */
  private readonly SUPPORT_ADMIN_LEVEL_ROLES: ReadonlySet<Role> = new Set([
    Role.SUPPORT_ADMIN,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PLATFORM_ADMIN,
  ]);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role as Role | undefined;
    return !!role && this.SUPPORT_ADMIN_LEVEL_ROLES.has(role);
  }
}