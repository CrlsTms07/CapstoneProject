// Centralized export for routers
module.exports = {
    authRoutes: require('../modules/auth/auth.routes'),
    passwordResetRequestsRoutes: require('../modules/auth/passwordReset.routes'),
    buildingsRoutes: require('../modules/rooms/buildings.routes'),
    departmentsRoutes: require('../modules/sections/departments.routes'),
    gradeLevelsRoutes: require('../modules/sections/gradeLevels.routes'),
    publicSchedulesRoutes: require('./publicSchedulesRoutes'),
    publicRolesRoutes: require('../modules/users/roles.public.routes'),
    rolesRoutes: require('../modules/users/roles.routes'),
    roomsRoutes: require('../modules/rooms/rooms.routes'),
    scheduleApprovalsRoutes: require('./scheduleApprovalsRoutes'),
    classProgramsRoutes: require('../modules/schedules/classPrograms.routes'),
    schedulesRoutes: require('../modules/schedules/schedules.routes'),
    sectionsRoutes: require('../modules/sections/sections.routes'),
    subjectsRoutes: require('../modules/subjects/subjects.routes'),
    teachersRoutes: require('../modules/teachers/teachers.routes'),
    teacherTasksRoutes: require('../modules/teachers/teacherTasks.routes'),
    timeSlotsRoutes: require('../modules/schedules/timeSlots.routes'),
    usersRoutes: require('../modules/users/users.routes')
};
