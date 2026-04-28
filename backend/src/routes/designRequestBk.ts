import { Router } from 'express';
import { authenticate, requirePasswordChanged } from '../middleware/auth';
import {
  listBkSports,
  listBkUsers,
  importBkSport,
  importBkSportFromDisk,
  patchBkImages,
  patchBkImagesFromDisk,
  deleteBkImport,
  deleteAllDesignRequests,
  imgProxy,
} from '../controllers/designRequestBk.controller';

const router = Router();

router.use(authenticate, requirePasswordChanged);

// 서버사이드 JSON 파일 상태 (선택적)
router.get('/sports', listBkSports);

// 전체 활성 사용자 목록 (매핑 UI 용)
router.get('/users', listBkUsers);

// JSON body → import (프론트에서 파일 업로드 후 전송)
router.post('/import/:sport', importBkSport);

// 서버 디스크 JSON → import (역프록시 413 회피 — 대용량 종목용)
router.post('/import-from-disk/:sport', importBkSportFromDisk);

// 이미지만 덮어쓰기 (기존 레코드 이미지 없을 때만 패치)
router.post('/patch-images/:sport', patchBkImages);

router.post('/patch-images-from-disk/:sport', patchBkImagesFromDisk);

// BK 데이터만 삭제
router.delete('/import/:sport', deleteBkImport);

// 전체 삭제 (비밀번호 필요)
router.delete('/all', deleteAllDesignRequests);

// 이미지 프록시 (WP hotlink 우회)
router.get('/img-proxy', imgProxy);

export default router;
