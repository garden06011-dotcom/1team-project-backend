import { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

// RAG 서비스 URL (환경 변수에서 읽거나 기본값 사용)
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
const RAG_SERVICE_TIMEOUT = parseInt(process.env.RAG_SERVICE_TIMEOUT || '30000', 10);

/**
 * RAG 챗봇 스트리밍 프록시 엔드포인트
 * 
 * Python RAG 서비스로 요청을 전달하고 SSE 스트리밍 응답을 프론트엔드로 전달합니다.
 */
export const ragChatStream = async (req: Request, res: Response) => {
  try {
    const { message, conversation_history } = req.body;

    // 요청 검증
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: '메시지가 필요합니다.',
        message: 'message 필드는 필수이며 비어있을 수 없습니다.'
      });
    }

    console.log(`[RAG Proxy] 요청 받음: ${message.substring(0, 50)}...`);
    console.log(`[RAG Proxy] 대화 히스토리: ${conversation_history?.length || 0}개`);

    // Python RAG 서비스로 요청 전달
    const response = await fetch(`${RAG_SERVICE_URL}/api/rag-chat-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
        conversation_history: conversation_history || []
      }),
      // 타임아웃 설정 (AbortController 사용)
    });

    // 에러 응답 처리
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RAG Proxy] Python 서비스 오류: ${response.status} - ${errorText}`);
      
      return res.status(response.status).json({
        error: 'RAG 서비스 오류',
        message: `Python RAG 서비스에서 오류가 발생했습니다: ${response.status}`,
        details: errorText
      });
    }

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 스트리밍 응답 전달
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[RAG Proxy] 스트리밍 완료');
            break;
          }

          // 청크를 디코딩하고 클라이언트로 전송
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          // 연결이 끊어졌는지 확인
          if (res.closed) {
            console.log('[RAG Proxy] 클라이언트 연결 종료');
            reader.cancel();
            break;
          }
        }
      } catch (streamError: any) {
        console.error('[RAG Proxy] 스트리밍 오류:', streamError);
        if (!res.closed) {
          res.write(`data: ${JSON.stringify({ event: 'error', message: '스트리밍 중 오류가 발생했습니다.' })}\n\n`);
        }
      } finally {
        if (!res.closed) {
          res.end();
        }
      }
    } else {
      // body가 없는 경우
      res.status(500).json({
        error: '스트리밍 응답을 받을 수 없습니다.',
        message: 'Python RAG 서비스에서 응답 본문을 받지 못했습니다.'
      });
    }

  } catch (error: any) {
    console.error('[RAG Proxy] 오류 발생:', error);

    // 연결이 이미 닫혔으면 응답하지 않음
    if (res.closed) {
      return;
    }

    // 타임아웃 또는 네트워크 오류
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'RAG 서비스 연결 실패',
        message: 'Python RAG 서비스에 연결할 수 없습니다. 서비스가 실행 중인지 확인해주세요.',
        details: error.message
      });
    }

    // 기타 오류
    res.status(500).json({
      error: '내부 서버 오류',
      message: '요청 처리 중 오류가 발생했습니다.',
      details: error.message
    });
  }
};

/**
 * RAG 서비스 상태 확인
 */
export const ragHealthCheck = async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5초 타임아웃
    });

    if (response.ok) {
      const data = await response.json();
      return res.json({
        status: 'ok',
        rag_service: 'connected',
        rag_service_url: RAG_SERVICE_URL,
        ...data
      });
    } else {
      return res.status(503).json({
        status: 'error',
        rag_service: 'unavailable',
        rag_service_url: RAG_SERVICE_URL
      });
    }
  } catch (error: any) {
    return res.status(503).json({
      status: 'error',
      rag_service: 'unavailable',
      rag_service_url: RAG_SERVICE_URL,
      error: error.message
    });
  }
};

