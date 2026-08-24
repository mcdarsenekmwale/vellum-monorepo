import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminService } from './admin.service';
import { AccessRequestsService } from '../access-requests/access-requests.service';

/**
 * Scheduled-task service that handles automatic permanent deletion of
 * soft-deleted users after the 30-day retention period, and auto-expiry
 * of temporary resource access grants.
 *
 * Runs daily at 02:00 server time. The sweeps are idempotent — safe to re-run.
 */
@Injectable()
export class SoftDeleteCronService {
  private readonly logger = new Logger(SoftDeleteCronService.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly accessRequestsService: AccessRequestsService,
  ) {}

  /**
   * Daily 02:00 — purge users soft-deleted more than 30 days ago.
   * Each user is purged in its own transaction so one failure doesn't
   * block the rest.
   */
  @Cron('0 2 * * *')
  async purgeExpiredSoftDeletedUsers() {
    this.logger.log('Starting daily soft-delete purge sweep (30-day retention)');
    try {
      const purged = await this.adminService.purgeExpiredSoftDeletedUsers(30);
      this.logger.log(`Soft-delete purge sweep complete: ${purged} users permanently deleted`);
    } catch (err) {
      this.logger.error('Soft-delete purge sweep failed', err);
    }
  }

  /**
   * Hourly — auto-expire temporary resource access grants that have passed
   * their expiresAt timestamp. Deactivates the UserResourceAccess record
   * and writes an audit log entry.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireTemporaryAccess() {
    this.logger.log('Starting hourly temporary access expiry sweep');
    try {
      const expired = await this.accessRequestsService.expireDueAccess();
      if (expired > 0) {
        this.logger.log(`Temporary access expiry sweep complete: ${expired} access grants deactivated`);
      }
    } catch (err) {
      this.logger.error('Temporary access expiry sweep failed', err);
    }
  }
}
