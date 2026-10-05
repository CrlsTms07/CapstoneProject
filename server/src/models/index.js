// Centralized export for models
module.exports = {
    authModel: require('../modules/auth/auth.service'),
    scheduleApprovalsModel: require('./scheduleApprovalsModel'),
    teacherTasksModel: require('../modules/teachers/teacherTasks.service')
};
