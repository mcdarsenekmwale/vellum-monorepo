function Cron() { return function() {}; }
const CronExpression = { EVERY_MINUTE: '* * * * *', EVERY_5_MINUTES: '*/5 * * * *' };
class SchedulerRegistry { constructor() {} }
const ScheduleModule = { forRoot: () => ({}) };
module.exports = { Cron, CronExpression, SchedulerRegistry, ScheduleModule };
