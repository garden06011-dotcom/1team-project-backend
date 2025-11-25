import express from 'express';
import { getAdminDashboard, getAdminUsers, deleteAdminUser, getAdminBoard, deleteAdminBoard } from '../controllers/AdminController';
import { checkAdmin } from '../middleware/CheckAdmin';
import { authenticateToken } from '../middleware/AuthJWT';

const router = express.Router();

// authenticateToken을 먼저 실행하여 req.user를 설정한 후, checkAdmin으로 권한 확인
router.get('/admin', authenticateToken, checkAdmin, getAdminDashboard);

router.get('/admin/user', authenticateToken, checkAdmin, getAdminUsers);

router.delete('/admin/user/:id', authenticateToken, checkAdmin, deleteAdminUser);

router.get('/admin/board', authenticateToken, checkAdmin, getAdminBoard);

router.delete('/admin/board/:id', authenticateToken, checkAdmin, deleteAdminBoard);

export default router;