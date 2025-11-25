import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/JwtUtils';

// Express Request 타입 확장
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      type: 'guest' | 'member' | 'admin';
    };
  }
}

/**
 * JWT 토큰 검증 미들웨어 (선택적 인증)
 * 
 * 이 미들웨어는 Authorization 헤더에서 Bearer 토큰을 추출하고 검증합니다.
 * 토큰이 유효하면 req.user에 사용자 정보를 추가합니다.
 * 토큰이 없거나 유효하지 않아도 요청은 통과하지만, req.user는 undefined입니다.
 * 
 * 사용 예시:
 * - 로그인한 유저와 비로그인 유저 모두 접근 가능하지만, 로그인한 유저에게만 추가 기능 제공
 * router.get('/board', checkToken, BoardPage);
 */
export const checkToken = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Authorization 헤더에서 토큰 추출
        const authHeader = req.headers.authorization;
        
        // 토큰이 없으면 그냥 통과 (req.user는 undefined)
        if (!authHeader) {
            next();
            return;
        }

        // Bearer 토큰 형식 확인
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            // 토큰 형식이 잘못되었어도 통과 (req.user는 undefined)
            next();
            return;
        }

        const token = parts[1];

        // 토큰 검증 시도
        try {
            const decoded = verifyAccessToken(token);
            
            // 토큰이 유효하면 req.user에 사용자 정보 추가
            req.user = {
                id: decoded.id,
                type: decoded.type,
            };
        } catch (error) {
            // 토큰이 유효하지 않거나 만료된 경우에도 통과
            // req.user는 undefined로 유지
            console.log('토큰 검증 실패 (선택적 인증이므로 통과):', error instanceof Error ? error.message : 'Unknown error');
        }

        // 다음 미들웨어로 진행
        next();
    } catch (error) {
        // 예상치 못한 오류가 발생해도 통과 (선택적 인증이므로)
        console.error('토큰 검증 미들웨어 오류 (선택적 인증이므로 통과):', error);
        next();
    }
};

