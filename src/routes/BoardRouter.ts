import { Router } from "express";
import { BoardPage, getBoardDetail, updateBoard, deleteBoard, saveBoard } from '../controllers/BoardController';

const router = Router();

router.get('/board', BoardPage); // 게시판

router.get('/board/:id', getBoardDetail); // 게시글 상세 페이지

router.post('/board/write', saveBoard); // 게시글 작성 저장하기

router.put('/board/:id', updateBoard); // 게시글 수정

router.delete('/board/:id', deleteBoard); // 게시글 삭제

export default router;
