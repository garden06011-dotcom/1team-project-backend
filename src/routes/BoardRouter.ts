import { Router } from "express";
import { BoardPage, getBoardDetail, updateBoard, deleteBoard, saveBoard, likeBoard, commentBoard, getUserBoards, getBoardEdit, deleteComment } from '../controllers/BoardController';

const router = Router();

router.get('/board', BoardPage); // 게시판

router.get('/board/user/:userId', getUserBoards); // 특정 사용자의 게시글

router.get('/board/:id', getBoardDetail); // 게시글 상세 페이지

router.post('/board/write', saveBoard); // 게시글 작성 저장하기

router.post('/board/:id/like', likeBoard); // 좋아요 클릭시 좋아요 수 증가

router.post('/board/:id/comment', commentBoard); // 댓글 작성 후 댓글 수 증가 및 댓글 내용 초기화 및 댓글 작성 후 댓글 리스트에 추가

router.delete('/board/:id/comment/:commentId', deleteComment); // 댓글 삭제 요청

router.get('/board/edit/:id', getBoardEdit); // 게시글 수정 불러오기

router.put('/board/edit/:id', updateBoard); // 게시글 수정

router.delete('/board/delete/:id', deleteBoard); // 게시글 삭제

export default router;
