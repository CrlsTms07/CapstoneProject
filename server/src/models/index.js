// Centralized export for models
module.exports = {
    authModel: require('../modules/auth/auth.service'),
    scheduleApprovalsModel: require('../modules/approvals/approvals.service'),
    teacherTasksModel: require('../modules/teachers/teacherTasks.service')
};
