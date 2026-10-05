function Cron() { return function() {}; }
const CronExpression = { EVERY_MINUTE: '* * * * *', EVERY_5_MINUTES: '*/5 * * * *' };
class SchedulerRegistry { constructor() {} }
class ScheduleModule { static forRoot() { return { module: ScheduleModule }; } }
module.exports = { Cron, CronExpression, SchedulerRegistry, ScheduleModule };
