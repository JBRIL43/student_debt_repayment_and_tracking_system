const express = require('express');
const {
	requireAdminAuth,
	requireStaffAuth,
	createStudent,
	listStudents,
	resetStudentPassword,
	deleteStudent,
	createUser,
	listUsers,
	resetUserPassword,
	deleteUser,
	updateUser,
	getDashboardStats,
	getStudentDebtDetails,
	getDepartmentStudents,
	getDepartmentPaymentRequests,
	approveDepartmentEnrollment,
	rejectDepartmentEnrollment,
	getReportSummary,
	streamAdminDashboard,
	getNotifications,
	markNotificationRead,
	deleteNotification,
	importSisData,
} = require('../controllers/adminController');
const {
	listPaymentRequests,
	verifyPaymentRequest,
	rejectPaymentRequest,
} = require('../controllers/financeController');
const {
	getEligibleClearance,
	issueClearance,
} = require('../controllers/registrarController');
const {
	uploadSISFile,
	confirmSISImport,
	getSISImportHistory,
	getSISImportBatchStudents,
	addStudentToMockSis,
} = require('../controllers/sisImportController');

const router = express.Router();

// Admin-only: create student in Firebase + PostgreSQL
router.post('/students', createStudent);
// Admin-only: list students
router.get('/students', requireAdminAuth, listStudents);
// Admin-only: reset student password
router.patch('/students/:studentId/password', requireAdminAuth, resetStudentPassword);
// Admin-only: delete student
router.delete('/students/:studentId', requireAdminAuth, deleteStudent);
// Admin-only: create any user
router.post('/users', requireAdminAuth, createUser);
// Admin-only: list all users
router.get('/users', requireAdminAuth, listUsers);
// Admin-only: dashboard stats
router.get('/stats', requireAdminAuth, getDashboardStats);
// Admin-only: student debt details
router.get('/debt-details', requireAdminAuth, getStudentDebtDetails);
// Department head: students from own department only
router.get('/department/students', getDepartmentStudents);
// Department head: pending payment requests in own department (academic eligibility check)
router.get('/department/requests', getDepartmentPaymentRequests);
// Department head: approve/reject academic eligibility only
router.post('/department/requests/:requestId/approve', approveDepartmentEnrollment);
router.post('/department/requests/:requestId/reject', rejectDepartmentEnrollment);
// Admin-only: reports summary
router.get('/reports/summary', requireAdminAuth, getReportSummary);
// Admin-only: notifications
router.get('/notifications', requireAdminAuth, getNotifications);
router.patch('/notifications/:notificationId/read', requireAdminAuth, markNotificationRead);
router.patch('/notifications/:notificationId/delete', requireAdminAuth, deleteNotification);
// Admin-only: simulated SIS import
router.post('/sis-import', requireAdminAuth, importSisData);
// Registrar or Admin: add student to mock SIS and import into main system
router.post('/sis/mock/students', requireStaffAuth(['Registrar', 'Admin']), addStudentToMockSis);
// Finance officer: list payment requests
router.get('/finance/requests', requireStaffAuth(['Finance Officer', 'Admin']), listPaymentRequests);
// Finance officer: verify payment request
router.post('/finance/requests/:requestId/verify', requireStaffAuth(['Finance Officer', 'Admin']), verifyPaymentRequest);
// Finance officer: reject payment request
router.post('/finance/requests/:requestId/reject', requireStaffAuth(['Finance Officer', 'Admin']), rejectPaymentRequest);
// Registrar: clearance list
router.get('/registrar/eligible', requireStaffAuth(['Registrar', 'Admin']), getEligibleClearance);
// Registrar: issue clearance letter
router.post('/registrar/issue', requireStaffAuth(['Registrar', 'Admin']), issueClearance);
// Admin-only: upload SIS CSV/Excel
router.post('/sis-import/upload', requireAdminAuth, uploadSISFile);
// Admin-only: confirm SIS import
router.post('/sis-import/confirm', requireAdminAuth, confirmSISImport);
// Admin-only: SIS import history
router.get('/sis-import/history', requireAdminAuth, getSISImportHistory);
// Admin-only: SIS import batch students
router.get('/sis-import/batch/:batchId/students', requireAdminAuth, getSISImportBatchStudents);
// Admin-only: SSE stream for real-time dashboard updates
router.get('/stream', streamAdminDashboard);
// Admin-only: reset password for any user
router.patch('/users/:userId/password', requireAdminAuth, resetUserPassword);
// Admin-only: update user profile
router.patch('/users/:userId', requireAdminAuth, updateUser);
// Admin-only: delete any user
router.delete('/users/:userId', requireAdminAuth, deleteUser);

module.exports = router;
