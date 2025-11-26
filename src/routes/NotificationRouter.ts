import { Router } from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../controllers/NotificationController';
import { authenticateToken } from '../middleware/AuthJWT';

const router = Router();

router.get('/notifications', authenticateToken, getNotifications); // 알림 목록 조회
router.put('/notifications/:id/read', authenticateToken, markNotificationAsRead); // 알림 읽음 처리
router.put('/notifications/read-all', authenticateToken, markAllNotificationsAsRead); // 모든 알림 읽음 처리
router.delete('/notifications/:id', authenticateToken, deleteNotification); // 알림 삭제

export default router;

