# JWT 인증 미들웨어 사용 가이드

## 개요

이 프로젝트는 두 가지 JWT 인증 미들웨어를 제공합니다:

1. **`authenticateToken`** (필수 인증) - 토큰이 반드시 있어야 하는 경우
2. **`checkToken`** (선택적 인증) - 토큰이 있으면 좋고, 없어도 되는 경우

## 미들웨어 위치

- `src/middleware/AuthJWT.ts` - 필수 인증 미들웨어
- `src/middleware/CheckJWTLogin.ts` - 선택적 인증 미들웨어

## 사용 방법

### 1. 필수 인증 미들웨어 (`authenticateToken`)

**사용 시나리오**: 로그인한 유저만 접근 가능한 기능
- 글쓰기
- 글 수정/삭제
- 댓글 작성
- 마이페이지
- 등등

**예시 코드**:

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/AuthJWT';
import { saveBoard, updateBoard, deleteBoard } from '../controllers/BoardController';

const router = Router();

// 글쓰기 - 로그인 필수
router.post('/board/write', authenticateToken, saveBoard);

// 글 수정 - 로그인 필수
router.put('/board/edit/:id', authenticateToken, updateBoard);

// 글 삭제 - 로그인 필수
router.delete('/board/delete/:id', authenticateToken, deleteBoard);
```

**컨트롤러에서 사용자 정보 사용**:

```typescript
export const saveBoard = async (req: Request, res: Response) => {
    try {
        // req.user는 authenticateToken 미들웨어에서 자동으로 추가됨
        if (!req.user) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }

        const userId = req.user.id; // 사용자 ID
        const userType = req.user.type; // 'guest' | 'member' | 'admin'

        // 글 작성 로직...
    } catch (error) {
        // 에러 처리...
    }
};
```

### 2. 선택적 인증 미들웨어 (`checkToken`)

**사용 시나리오**: 로그인한 유저와 비로그인 유저 모두 접근 가능하지만, 로그인한 유저에게만 추가 기능 제공
- 게시판 목록 (비로그인도 볼 수 있지만, 로그인한 유저는 좋아요 표시 등)
- 게시글 상세 (비로그인도 볼 수 있지만, 로그인한 유저는 댓글 작성 가능)

**예시 코드**:

```typescript
import { Router } from 'express';
import { checkToken } from '../middleware/CheckJWTLogin';
import { BoardPage, getBoardDetail } from '../controllers/BoardController';

const router = Router();

// 게시판 목록 - 비로그인도 접근 가능
router.get('/board', checkToken, BoardPage);

// 게시글 상세 - 비로그인도 접근 가능
router.get('/board/:id', checkToken, getBoardDetail);
```

**컨트롤러에서 사용자 정보 사용**:

```typescript
export const BoardPage = async (req: Request, res: Response) => {
    try {
        // req.user는 토큰이 있을 때만 존재 (없으면 undefined)
        const isLoggedIn = !!req.user;
        
        if (isLoggedIn) {
            // 로그인한 유저에게만 제공하는 기능
            const userId = req.user.id;
            // 좋아요 표시, 북마크 등...
        } else {
            // 비로그인 유저는 기본 기능만
        }

        // 게시판 목록 조회 로직...
    } catch (error) {
        // 에러 처리...
    }
};
```

## 프론트엔드에서 토큰 전송 방법

### Authorization 헤더에 Bearer 토큰 포함

```typescript
// axios 예시
const response = await axios.get('/board', {
    headers: {
        'Authorization': `Bearer ${accessToken}`
    }
});
```

### axios 인터셉터 사용 (권장)

```typescript
// axiosApi.ts
API.interceptors.request.use(
    (config) => {
        const token = getTokenFromStore(); // localStorage나 store에서 토큰 가져오기
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);
```

## 응답 형식

### 로그인 성공 응답

```json
{
    "message": "로그인 성공",
    "user": {
        "idx": 1,
        "email": "user@example.com",
        "nickname": "사용자",
        "role": "member"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessTokenExpiresIn": "15m",
    "refreshTokenExpiresIn": "7d"
}
```

### 인증 실패 응답 (401)

```json
{
    "message": "인증 토큰이 필요합니다.",
    "error": "No token provided"
}
```

또는

```json
{
    "message": "유효하지 않거나 만료된 토큰입니다.",
    "error": "Invalid or expired accesstoken"
}
```

## 라우터 설정 예시

### BoardRouter.ts 전체 예시

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/AuthJWT';
import { checkToken } from '../middleware/CheckJWTLogin';
import { 
    BoardPage, 
    getBoardDetail, 
    saveBoard, 
    updateBoard, 
    deleteBoard 
} from '../controllers/BoardController';

const router = Router();

// 비로그인도 접근 가능
router.get('/board', checkToken, BoardPage);
router.get('/board/:id', checkToken, getBoardDetail);

// 로그인 필수
router.post('/board/write', authenticateToken, saveBoard);
router.put('/board/edit/:id', authenticateToken, updateBoard);
router.delete('/board/delete/:id', authenticateToken, deleteBoard);

export default router;
```

## 주의사항

1. **토큰 만료 시간**: Access Token은 15분, Refresh Token은 7일입니다.
2. **토큰 형식**: 반드시 `Bearer <token>` 형식으로 전송해야 합니다.
3. **타입 안정성**: `req.user`는 TypeScript 타입이 확장되어 있어 자동완성이 지원됩니다.
4. **에러 처리**: 미들웨어에서 에러가 발생하면 자동으로 응답을 보내므로, 컨트롤러에서는 `req.user`가 존재한다고 가정할 수 있습니다 (필수 인증의 경우).

