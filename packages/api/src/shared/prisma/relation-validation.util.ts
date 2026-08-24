import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type PrismaLike = Pick<
  Prisma.TransactionClient,
  'supportDepartment' | 'supportTeam' | 'user'
>;

/**
 * Ensure a support department exists and is not soft-deleted.
 */
export async function validateSupportDepartmentExists(
  prisma: PrismaLike,
  departmentId: string,
): Promise<void> {
  const dept = await prisma.supportDepartment.findUnique({ where: { id: departmentId } });
  if (!dept || dept.deletedAt) {
    throw new NotFoundException(`Department with ID ${departmentId} not found`);
  }
}

/**
 * Ensure a support team exists and is not soft-deleted.
 */
export async function validateSupportTeamExists(
  prisma: PrismaLike,
  teamId: string,
): Promise<void> {
  const team = await prisma.supportTeam.findUnique({ where: { id: teamId } });
  if (!team || team.deletedAt) {
    throw new NotFoundException(`Team with ID ${teamId} not found`);
  }
}

/**
 * Ensure a user exists (for lead/head relation targets).
 */
export async function validateUserExists(
  prisma: PrismaLike,
  userId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundException(`User with ID ${userId} not found`);
  }
}
