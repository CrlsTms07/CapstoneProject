// Centralized export for routers
module.exports = {
    authRoutes: require('../modules/auth/auth.routes'),
    passwordResetRequestsRoutes: require('../modules/auth/passwordReset.routes'),
    buildingsRoutes: require('./buildingsRoutes'),
    departmentsRoutes: require('./departmentsRoutes'),
    gradeLevelsRoutes: require('./gradeLevelsRoutes'),
    publicSchedulesRoutes: require('./publicSchedulesRoutes'),
    publicRolesRoutes: require('./publicRolesRoutes'),
    rolesRoutes: require('./rolesRoutes'),
    roomsRoutes: require('./roomsRoutes'),
    scheduleApprovalsRoutes: require('./scheduleApprovalsRoutes'),
    classProgramsRoutes: require('./classProgramsRoutes'),
    schedulesRoutes: require('./schedulesRoutes'),
    sectionsRoutes: require('./sectionsRoutes'),
    subjectsRoutes: require('./subjectsRoutes'),
    teachersRoutes: require('./teachersRoutes'),
    teacherTasksRoutes: require('./teacherTasksRoutes'),
    timeSlotsRoutes: require('./timeSlotsRoutes'),
    usersRoutes: require('./usersRoutes')
};
