// Express Request 타입 확장
// 미들웨어에서 토큰 검증 후 user 정보를 req에 추가할 수 있도록 타입 확장

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        type: 'guest' | 'member' | 'admin';
      };
    }
  }
}

