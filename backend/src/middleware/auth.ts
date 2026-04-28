import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    forcePasswordChange: boolean;
    position?: string | null;
  };
}

/**
 * JWT 검증 후 DB에 사용자가 존재하는지 확인합니다.
 * DB 초기화·계정 삭제 후에도 옛 토큰이 남아 있으면 `req.user.id`가 users에 없어 FK 오류가 나므로 여기서 차단합니다.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: '인증 토큰이 없습니다.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthRequest['user'];
    if (!decoded?.id) {
      res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { profile: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        message: '세션이 만료되었거나 계정을 찾을 수 없습니다. 다시 로그인해 주세요.',
      });
      return;
    }

    const position = (user.profile as { position?: string } | null)?.position ?? null;
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      forcePasswordChange: user.forcePasswordChange,
      position,
    };
    next();
  } catch (e: unknown) {
    if (e instanceof JsonWebTokenError || e instanceof TokenExpiredError) {
      res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
      return;
    }
    console.error('[auth] authenticate', e);
    res.status(500).json({ message: '인증 처리 중 오류가 발생했습니다.' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: '권한이 없습니다.' });
      return;
    }
    next();
  };
};

/** MANAGER, SUPER_ADMIN 또는 CS(직책 무관) — 정형문 관리 등 */
export const requireManagerSuperOrCs = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: '권한이 없습니다.' });
    return;
  }
  const { role } = req.user;
  if (role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'CS') {
    next();
    return;
  }
  res.status(403).json({ message: '권한이 없습니다.' });
};

/** MANAGER, SUPER_ADMIN 또는 직책이 CS총괄인 CS에게 관리자 권한 허용 */
export const requireManagerOrCsChief = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: '권한이 없습니다.' });
    return;
  }
  const { role, position } = req.user;
  if (role === 'MANAGER' || role === 'SUPER_ADMIN') {
    next();
    return;
  }
  if (role === 'CS' && position === 'CS총괄') {
    next();
    return;
  }
  res.status(403).json({ message: '권한이 없습니다.' });
};

/** DESIGNER 또는 MANAGER/SUPER_ADMIN/CS총괄 (외국인 근태 조회용) */
export const requireDesignerOrManagerOrCsChief = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: '권한이 없습니다.' });
    return;
  }
  const { role, position } = req.user;
  if (role === 'DESIGNER') {
    next();
    return;
  }
  if (role === 'MANAGER' || role === 'SUPER_ADMIN') {
    next();
    return;
  }
  if (role === 'CS' && position === 'CS총괄') {
    next();
    return;
  }
  res.status(403).json({ message: '권한이 없습니다.' });
};

/** 디자인 요청 일별 통계: MANAGER, SUPER_ADMIN, DESIGNER, 또는 직책이 스포츠통괄인 CS */
export const requireDesignRequestStatsAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: '권한이 없습니다.' });
    return;
  }
  const { role, position } = req.user;
  if (role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'DESIGNER') {
    next();
    return;
  }
  const pos = position?.replace(/\s/g, '') ?? '';
  if (role === 'CS' && pos === '스포츠통괄') {
    next();
    return;
  }
  res.status(403).json({ message: '권한이 없습니다.' });
};

/** 번역 딕셔너리·가이드 수정: MANAGER, SUPER_ADMIN, DESIGNER */
export const requireTranslationEditor = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: '권한이 없습니다.' });
    return;
  }
  const { role } = req.user;
  if (role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'DESIGNER') {
    next();
    return;
  }
  res.status(403).json({ message: '권한이 없습니다.' });
};

/** 디자인 요청·재요청 등록: CS·관리자·대표·디자이너 */
export const requireDesignRequestCreator = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: '권한이 없습니다.' });
    return;
  }
  if (['CS', 'MANAGER', 'SUPER_ADMIN', 'DESIGNER'].includes(req.user.role)) {
    next();
    return;
  }
  res.status(403).json({ message: '권한이 없습니다.' });
};

export const requirePasswordChanged = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.forcePasswordChange) {
    res.status(403).json({ message: '비밀번호를 변경해야 합니다.', code: 'FORCE_PASSWORD_CHANGE' });
    return;
  }
  next();
};
