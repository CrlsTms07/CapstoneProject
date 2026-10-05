// Centralized export for routers
module.exports = {
    authRoutes: require('../modules/auth/auth.routes'),
    passwordResetRequestsRoutes: require('../modules/auth/passwordReset.routes'),
    buildingsRoutes: require('./buildingsRoutes'),
    departmentsRoutes: require('../modules/sections/departments.routes'),
    gradeLevelsRoutes: require('../modules/sections/gradeLevels.routes'),
    publicSchedulesRoutes: require('./publicSchedulesRoutes'),
    publicRolesRoutes: require('../modules/users/roles.public.routes'),
    rolesRoutes: require('../modules/users/roles.routes'),
    roomsRoutes: require('./roomsRoutes'),
    scheduleApprovalsRoutes: require('./scheduleApprovalsRoutes'),
    classProgramsRoutes: require('./classProgramsRoutes'),
    schedulesRoutes: require('./schedulesRoutes'),
    sectionsRoutes: require('../modules/sections/sections.routes'),
    subjectsRoutes: require('./subjectsRoutes'),
    teachersRoutes: require('../modules/teachers/teachers.routes'),
    teacherTasksRoutes: require('../modules/teachers/teacherTasks.routes'),
    timeSlotsRoutes: require('./timeSlotsRoutes'),
    usersRoutes: require('../modules/users/users.routes')
};
