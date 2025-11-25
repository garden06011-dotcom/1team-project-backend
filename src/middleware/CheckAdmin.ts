import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export const checkAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('checkAdmin 실행됨');
        console.log('req.user:', req.user);
        
        // 1. req.user가 없거나 type이 admin이 아니면 거부
        if(!req.user || req.user.type !== 'admin') {
            console.log('req.user가 없거나 type이 admin이 아님:', req.user);
            return res.status(403).json({ message: '관리자 권한이 없습니다' });
        }

        // 2. DB에서 사용자 정보 조회하여 role 확인
        const user = await prisma.users.findUnique({
            where: { idx: req.user.id },
            select: { user_id: true, role: true }
        });

        console.log('DB에서 조회한 사용자:', user);

        if(!user) {
            console.log('사용자를 찾을 수 없음');
            return res.status(403).json({ message: '관리자 권한이 없습니다' });
        }

        // role이 'admin'인지 확인
        if(user.role !== 'admin') {
            console.log('role이 admin이 아님:', user.role);
            return res.status(403).json({ message: '관리자 권한이 없습니다' });
        }

        next();
    } catch (error) {
        console.error('관리자 권한 확인 오류:', error);
        return res.status(500).json({ message: '관리자 권한 확인 중 오류가 발생했습니다.' });
    }
}