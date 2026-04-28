-- 일본어 원문 요청에 대한 디자이너용 한국어 번역, 재요청 코멘트 한국어 번역
ALTER TABLE "design_requests" ADD COLUMN IF NOT EXISTS "initial_request_ko" TEXT;
ALTER TABLE "design_request_replies" ADD COLUMN IF NOT EXISTS "content_ko" TEXT;
