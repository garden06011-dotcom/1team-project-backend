import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/JwtUtils';

// Express Request 타입 확장 (타입 정의 파일이 인식되지 않을 때를 대비한 직접 선언)
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      type: 'guest' | 'member' | 'admin';
    };
  }
}

/**
 * JWT 토큰 검증 미들웨어 (필수 인증)
 * 
 * 이 미들웨어는 Authorization 헤더에서 Bearer 토큰을 추출하고 검증합니다.
 * 토큰이 유효하면 req.user에 사용자 정보를 추가하고, 
 * 토큰이 없거나 유효하지 않으면 401 Unauthorized 에러를 반환합니다.
 * 
 * 사용 예시:
 * router.post('/board/write', authenticateToken, saveBoard);
 */
export const authenticateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Authorization 헤더에서 토큰 추출
        // 형식: "Bearer <token>"
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            res.status(401).json({ 
                message: '인증 토큰이 필요합니다.',
                error: 'No token provided'
            });
            return;
        }

        // Bearer 토큰 형식 확인
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            res.status(401).json({ 
                message: '잘못된 토큰 형식입니다.',
                error: 'Invalid token format'
            });
            return;
        }

        const token = parts[1];

        // 토큰 검증
        try {
            const decoded = verifyAccessToken(token);
            
            // req.user에 사용자 정보 추가
            req.user = {
                id: decoded.id,
                type: decoded.type,
            };

            // 다음 미들웨어로 진행
            next();
        } catch (error) {
            // 토큰이 유효하지 않거나 만료된 경우
            res.status(401).json({ 
                message: '유효하지 않거나 만료된 토큰입니다.',
                error: error instanceof Error ? error.message : 'Token verification failed'
            });
            return;
        }
    } catch (error) {
        console.error('인증 미들웨어 오류:', error);
        res.status(500).json({ 
            message: '인증 처리 중 오류가 발생했습니다.',
            error: 'Authentication error'
        });
        return;
    }
};
