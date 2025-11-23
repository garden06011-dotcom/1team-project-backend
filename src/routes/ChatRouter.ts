import { Router } from 'express';
import { ragChatStream, ragHealthCheck } from '../controllers/ChatController';

const router = Router();

// RAG 챗봇 스트리밍 엔드포인트
router.post('/rag-chat-stream', ragChatStream);

// RAG 서비스 상태 확인
router.get('/rag-health', ragHealthCheck);

export default router;

