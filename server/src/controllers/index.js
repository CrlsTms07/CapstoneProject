// Centralized export for controllers (MVC-friendly)
module.exports = {
    authControllers: require('../modules/auth/auth.controller'),
    buildingsControllers: require('./buildingsControllers'),
    departmentsControllers: require('../modules/sections/departments.controller'),
    gradeLevelsControllers: require('../modules/sections/gradeLevels.controller'),
    publicSchedulesControllers: require('./publicSchedulesControllers'),
    rolesControllers: require('../modules/users/roles.controller'),
    roomsControllers: require('./roomsControllers'),
    scheduleApprovalsControllers: require('./scheduleApprovalsControllers'),
    schedulesControllers: require('./schedulesControllers'),
    sectionsControllers: require('../modules/sections/sections.controller'),
    subjectsControllers: require('./subjectsControllers'),
    teachersControllers: require('../modules/teachers/teachers.controller'),
    teacherTasksControllers: require('../modules/teachers/teacherTasks.controller'),
    timeSlotsControllers: require('./timeSlotsControllers'),
    usersControllers: require('../modules/users/users.controller')
};
