-- 초기 요청 원문 언어, 재요청 영어 번역문
ALTER TABLE "design_requests" ADD COLUMN IF NOT EXISTS "initial_request_lang" VARCHAR(8) NOT NULL DEFAULT 'ko';

ALTER TABLE "design_request_replies" ADD COLUMN IF NOT EXISTS "content_en" TEXT;
