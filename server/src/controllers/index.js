// Centralized export for controllers (MVC-friendly)
module.exports = {
    authControllers: require('../modules/auth/auth.controller'),
    buildingsControllers: require('../modules/rooms/buildings.controller'),
    departmentsControllers: require('../modules/sections/departments.controller'),
    gradeLevelsControllers: require('../modules/sections/gradeLevels.controller'),
    publicSchedulesControllers: require('./publicSchedulesControllers'),
    rolesControllers: require('../modules/users/roles.controller'),
    roomsControllers: require('../modules/rooms/rooms.controller'),
    scheduleApprovalsControllers: require('../modules/approvals/approvals.controller'),
    schedulesControllers: require('../modules/schedules/schedules.controller'),
    sectionsControllers: require('../modules/sections/sections.controller'),
    subjectsControllers: require('../modules/subjects/subjects.controller'),
    teachersControllers: require('../modules/teachers/teachers.controller'),
    teacherTasksControllers: require('../modules/teachers/teacherTasks.controller'),
    timeSlotsControllers: require('../modules/schedules/timeSlots.controller'),
    usersControllers: require('../modules/users/users.controller')
};
