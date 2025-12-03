import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

// 사용자의 알림 목록 조회
export const getNotifications = async (req: Request, res: Response) => {
  try {
    // req.user는 authenticateToken 미들웨어에서 설정됨
    // 변경 전: req.user?.id 체크만 수행
    // 변경 후: 상세한 에러 로깅 추가
    if (!req.user?.id) {
      console.error('getNotifications: req.user가 없거나 id가 없음', req.user);
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    console.log('getNotifications: req.user.id', req.user.id);

    // users 테이블에서 user_id(email) 가져오기
    // 변경 전: 단순 조회
    // 변경 후: 에러 처리 개선
    let user;
    try {
      user = await prisma.users.findUnique({
        where: { idx: req.user.id },
        select: { user_id: true },
      });
    } catch (dbError: any) {
      console.error('getNotifications: 사용자 조회 실패', dbError);
      return res.status(500).json({ 
        message: '사용자 정보 조회에 실패했습니다.', 
        error: dbError?.message || dbError 
      });
    }

    if (!user || !user.user_id) {
      console.error('getNotifications: 사용자를 찾을 수 없음', req.user.id);
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 알림 목록 조회
    // 변경 전: 단순 조회
    // 변경 후: 에러 처리 개선
    let notifications;
    try {
      notifications = await prisma.notifications.findMany({
        where: {
          user_id: user.user_id,
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } catch (dbError: any) {
      console.error('getNotifications: 알림 조회 실패', dbError);
      return res.status(500).json({ 
        message: '알림 조회에 실패했습니다.', 
        error: dbError?.message || dbError 
      });
    }

    res.status(200).json({
      message: '알림 조회 성공',
      data: notifications,
    });
  } catch (error: any) {
    console.error('getNotifications 전체 에러:', error);
    console.error('에러 스택:', error?.stack);
    res.status(500).json({ 
      message: '알림 조회에 실패했습니다.', 
      error: error?.message || error,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
};

// 알림 읽음 처리
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: '유효하지 않은 알림 ID입니다.' });
    }

    // users 테이블에서 user_id(email) 가져오기
    const user = await prisma.users.findUnique({
      where: { idx: req.user.id },
      select: { user_id: true },
    });

    if (!user || !user.user_id) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 알림이 해당 사용자의 것인지 확인
    const notification = await prisma.notifications.findUnique({
      where: { idx: Number(id) },
    });

    if (!notification) {
      return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
    }

    if (notification.user_id !== user.user_id) {
      return res.status(403).json({ message: '알림 읽음 처리 권한이 없습니다.' });
    }

    const updatedNotification = await prisma.notifications.update({
      where: { idx: Number(id) },
      data: { is_read: true },
    });

    res.status(200).json({
      message: '알림 읽음 처리 성공',
      data: updatedNotification,
    });
  } catch (error: any) {
    console.error('알림 읽음 처리 실패:', error);
    res.status(500).json({ message: '알림 읽음 처리에 실패했습니다.', error: error.message });
  }
};

// 모든 알림 읽음 처리
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    // users 테이블에서 user_id(email) 가져오기
    const user = await prisma.users.findUnique({
      where: { idx: req.user.id },
      select: { user_id: true },
    });

    if (!user || !user.user_id) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    await prisma.notifications.updateMany({
      where: {
        user_id: user.user_id,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    res.status(200).json({
      message: '모든 알림 읽음 처리 성공',
    });
  } catch (error: any) {
    console.error('모든 알림 읽음 처리 실패:', error);
    res.status(500).json({ message: '모든 알림 읽음 처리에 실패했습니다.', error: error.message });
  }
};

// 알림 삭제
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: '유효하지 않은 알림 ID입니다.' });
    }

    // users 테이블에서 user_id(email) 가져오기
    const user = await prisma.users.findUnique({
      where: { idx: req.user.id },
      select: { user_id: true },
    });

    if (!user || !user.user_id) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 알림이 해당 사용자의 것인지 확인
    const notification = await prisma.notifications.findUnique({
      where: { idx: Number(id) },
    });

    if (!notification) {
      return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
    }

    if (notification.user_id !== user.user_id) {
      return res.status(403).json({ message: '알림 삭제 권한이 없습니다.' });
    }

    await prisma.notifications.delete({
      where: { idx: Number(id) },
    });

    res.status(200).json({
      message: '알림 삭제 성공',
    });
  } catch (error: any) {
    console.error('알림 삭제 실패:', error);
    res.status(500).json({ message: '알림 삭제에 실패했습니다.', error: error.message });
  }
};

