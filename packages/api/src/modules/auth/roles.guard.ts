import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as Role;

    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    const hasRequiredRole = requiredRoles.some((role) => {
      // Role hierarchy (least → most privileged). Any role at a HIGHER index
      // automatically inherits permissions of all lower-indexed roles, so
      // e.g. @Roles(Role.MODERATOR) is also passed by SUPPORT_ADMIN, ADMIN,
      // PLATFORM_ADMIN, and SUPER_ADMIN.
      const roleOrder = [
        Role.GUEST,
        Role.USER,
        Role.CREATOR,
        Role.MODERATOR,
        Role.SUPPORT_ADMIN,
        Role.ADMIN,
        Role.PLATFORM_ADMIN,
        Role.SUPER_ADMIN,
      ];
      const userRoleIndex = roleOrder.indexOf(userRole);
      const requiredRoleIndex = roleOrder.indexOf(role);
      // Unknown roles default to -1 (insufficient) to avoid privilege escalation.
      if (userRoleIndex === -1 || requiredRoleIndex === -1) return false;
      return userRoleIndex >= requiredRoleIndex;
    });

    if (!hasRequiredRole) {
      // Do NOT echo the user's role back to the client — that leaks internal
      // authorization state and aids reconnaissance.
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}