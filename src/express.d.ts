// Express Request 타입 확장
// 미들웨어에서 토큰 검증 후 user 정보를 req에 추가할 수 있도록 타입 확장
// 타입 정의 파일(.d.ts)에서는 import 없이 declare만 사용

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

// 이 파일을 모듈로 인식시키기 위한 export (비어있어도 됨)
export {};

