import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
});

const chatTranslationModeSchema = z.enum([
  'none',
  'ko-en',
  'ko-ja',
  'en-ko',
  'en-ja',
  'ja-en',
  'ja-ko',
]);

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return;
  }

  const profile = user.profile as {
    preferredLanguage?: string;
    position?: string;
    chatTranslationMode?: string;
  } | null;
  const position = profile?.position ?? null;

  const secret = process.env.JWT_SECRET || '';
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      forcePasswordChange: user.forcePasswordChange,
      position,
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      forcePasswordChange: user.forcePasswordChange,
      name: user.profile?.name,
      preferredLanguage: profile?.preferredLanguage ?? 'ko',
      position,
      chatTranslationMode: profile?.chatTranslationMode ?? 'none',
    },
  });
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { currentPassword, newPassword } = result.data;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { profile: true },
  });
  if (!user) {
    res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    return;
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    res.status(400).json({ message: '현재 비밀번호가 올바르지 않습니다.' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, forcePasswordChange: false },
  });

  const position = (user.profile as { position?: string } | null)?.position ?? null;

  const secret = process.env.JWT_SECRET || '';
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      forcePasswordChange: false,
      position,
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  res.json({ message: '비밀번호가 변경되었습니다.', token });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { profile: { include: { department: true } } },
  });

  if (!user) {
    res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    return;
  }

  const profile = user.profile as { preferredLanguage?: string; chatTranslationMode?: string; avatarS3Key?: string | null } | null;
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    forcePasswordChange: user.forcePasswordChange,
    name: user.profile?.name,
    position: user.profile?.position,
    department: user.profile?.department?.name,
    hireDate: user.profile?.hireDate,
    phone: user.profile?.phone,
    preferredLanguage: profile?.preferredLanguage ?? 'ko',
    chatTranslationMode: profile?.chatTranslationMode ?? 'none',
    avatarS3Key: profile?.avatarS3Key ?? null,
  });
};

export const patchChatTranslation = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ chatTranslationMode: chatTranslationModeSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '유효하지 않은 번역 모드입니다.' });
    return;
  }
  await prisma.employeeProfile.update({
    where: { userId: req.user!.id },
    data: { chatTranslationMode: parsed.data.chatTranslationMode } as any,
  });
  res.json({ chatTranslationMode: parsed.data.chatTranslationMode });
};
