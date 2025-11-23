# 쿠키 vs JWT 토큰 비교

## 개요

인증을 구현하는 방법은 크게 두 가지가 있습니다:
1. **JWT 토큰을 HTTP 헤더에 담아서 전송** (현재 방식)
2. **JWT 토큰을 HTTP 쿠키에 담아서 전송**

## 현재 방식: Authorization 헤더 + JWT 토큰

### 작동 방식
```
클라이언트 → 서버 요청
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 장점
1. **명시적 제어**: 클라이언트가 토큰을 명시적으로 관리하고 전송
2. **크로스 도메인 문제 없음**: CORS 설정만 하면 됨
3. **모바일 앱 친화적**: 모바일 앱에서도 쉽게 구현 가능
4. **캐싱 문제 없음**: 쿠키처럼 브라우저가 자동으로 캐싱하지 않음
5. **디버깅 용이**: 개발자 도구에서 헤더를 쉽게 확인 가능

### 단점
1. **XSS 취약점**: JavaScript로 localStorage나 메모리에 저장하면 XSS 공격에 취약
2. **수동 관리 필요**: 클라이언트가 토큰을 직접 저장하고 관리해야 함
3. **CSRF는 안전**: 하지만 쿠키보다는 CSRF 공격에 덜 취약

## 쿠키 방식: HTTP Cookie + JWT 토큰

### 작동 방식
```
서버 → 클라이언트 응답
Set-Cookie: accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict

클라이언트 → 서버 요청
Cookie: accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 장점
1. **XSS 공격 방어**: `HttpOnly` 플래그로 JavaScript 접근 차단 가능
2. **자동 전송**: 브라우저가 자동으로 쿠키를 포함해서 요청 전송
3. **서버 제어**: 서버가 쿠키 만료 시간, 도메인 등을 제어 가능
4. **보안 플래그 활용**: `Secure`, `SameSite` 등으로 보안 강화 가능

### 단점
1. **CSRF 취약점**: 쿠키는 자동으로 전송되므로 CSRF 공격에 취약 (SameSite로 완화 가능)
2. **크로스 도메인 복잡**: 다른 도메인 간 쿠키 공유가 복잡함
3. **모바일 앱 제한**: 모바일 네이티브 앱에서 쿠키 관리가 복잡함
4. **캐싱 문제**: 브라우저가 쿠키를 캐싱할 수 있음

## 보안 비교

### XSS (Cross-Site Scripting) 공격

**헤더 방식 (현재)**:
- ❌ localStorage에 저장하면 JavaScript로 접근 가능 → XSS 공격에 취약
- ✅ 메모리(변수)에만 저장하면 상대적으로 안전하지만, 새로고침 시 사라짐

**쿠키 방식**:
- ✅ `HttpOnly` 플래그 사용 시 JavaScript 접근 불가 → XSS 공격 방어
- ✅ 서버에서 쿠키 설정 시 자동으로 보안 적용

### CSRF (Cross-Site Request Forgery) 공격

**헤더 방식 (현재)**:
- ✅ JavaScript로 명시적으로 헤더에 추가해야 함 → CSRF 공격에 상대적으로 안전
- ✅ 악의적인 사이트가 자동으로 헤더를 추가하기 어려움

**쿠키 방식**:
- ❌ 브라우저가 자동으로 쿠키를 전송 → CSRF 공격에 취약
- ✅ `SameSite=Strict` 플래그로 완화 가능하지만 완벽하지 않음

## 실제 구현 비교

### 현재 방식 (헤더) 구현

**백엔드**:
```typescript
// 미들웨어에서 헤더에서 토큰 추출
const authHeader = req.headers.authorization;
const token = authHeader?.split(' ')[1];
```

**프론트엔드**:
```typescript
// axios 인터셉터
API.interceptors.request.use((config) => {
    const token = getTokenFromStore();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

### 쿠키 방식 구현

**백엔드**:
```typescript
import cookieParser from 'cookie-parser';
app.use(cookieParser());

// 로그인 시 쿠키 설정
res.cookie('accessToken', token, {
    httpOnly: true,      // JavaScript 접근 차단
    secure: true,        // HTTPS에서만 전송
    sameSite: 'strict',  // CSRF 방어
    maxAge: 15 * 60 * 1000 // 15분
});

// 미들웨어에서 쿠키에서 토큰 추출
const token = req.cookies.accessToken;
```

**프론트엔드**:
```typescript
// 쿠키는 자동으로 전송되므로 별도 설정 불필요
// 단, axios에서 withCredentials: true 설정 필요
const API = axios.create({
    baseURL: 'http://localhost:8000',
    withCredentials: true  // 쿠키 전송 허용
});
```

## 권장 사항

### 현재 방식 (헤더)이 더 나은 경우
1. **모바일 앱과 웹을 함께 지원**하는 경우
2. **명시적인 토큰 관리**가 필요한 경우
3. **크로스 도메인 요청**이 많은 경우
4. **CSRF 공격을 우려**하는 경우

### 쿠키 방식이 더 나은 경우
1. **웹 전용 애플리케이션**인 경우
2. **XSS 공격을 우려**하는 경우
3. **서버가 토큰을 완전히 제어**하고 싶은 경우
4. **자동 토큰 전송**이 필요한 경우

## 하이브리드 방식 (권장)

가장 안전한 방법은 **Refresh Token은 쿠키에, Access Token은 헤더에** 저장하는 방식입니다:

```typescript
// 로그인 시
const { accessToken, refreshToken } = generateToeknPair(payload);

// Access Token은 헤더로 응답 (클라이언트가 메모리에 저장)
res.json({ accessToken });

// Refresh Token은 HttpOnly 쿠키로 설정
res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
});
```

이 방식의 장점:
- ✅ Access Token은 XSS에 취약하지만 짧은 수명 (15분)
- ✅ Refresh Token은 HttpOnly 쿠키로 XSS 방어
- ✅ Access Token은 헤더로 CSRF 방어
- ✅ 두 가지 공격 모두에 대한 방어

## 결론

**현재 프로젝트에서는 헤더 방식이 적합합니다** 왜냐하면:
1. 모바일 앱 지원 가능
2. CSRF 공격에 상대적으로 안전
3. 구현이 간단하고 명시적
4. 크로스 도메인 요청에 유리

**하지만 보안을 더 강화하려면**:
- Access Token을 메모리에만 저장 (localStorage 사용 지양)
- Refresh Token은 HttpOnly 쿠키에 저장 (하이브리드 방식)
- 토큰 만료 시간을 짧게 설정 (현재 15분은 적절)

