// Centralized export for controllers (MVC-friendly)
module.exports = {
    authControllers: require('../modules/auth/auth.controller'),
    buildingsControllers: require('./buildingsControllers'),
    departmentsControllers: require('./departmentsControllers'),
    gradeLevelsControllers: require('./gradeLevelsControllers'),
    publicSchedulesControllers: require('./publicSchedulesControllers'),
    rolesControllers: require('../modules/users/roles.controller'),
    roomsControllers: require('./roomsControllers'),
    scheduleApprovalsControllers: require('./scheduleApprovalsControllers'),
    schedulesControllers: require('./schedulesControllers'),
    sectionsControllers: require('./sectionsControllers'),
    subjectsControllers: require('./subjectsControllers'),
    teachersControllers: require('./teachersControllers'),
    teacherTasksControllers: require('./teacherTasksControllers'),
    timeSlotsControllers: require('./timeSlotsControllers'),
    usersControllers: require('../modules/users/users.controller')
};
