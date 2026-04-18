-- 이메일 인증 전환에 따른 users 테이블 스키마 업데이트
-- Supabase SQL Editor에서 실행하세요

-- 1. phone NOT NULL 제약 제거 (이메일 전용 사용자는 phone 없음)
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- 2. phone UNIQUE 제약 제거 (NULL 값이 여러 행에 들어갈 수 있음)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key;

-- 3. 기존 빈 문자열 phone 값을 NULL로 정리
UPDATE public.users SET phone = NULL WHERE phone = '';

-- 4. email 컬럼을 unique로 (이메일 인증 기반 식별자)
-- (선택사항 — 기존 email 중복이 없을 경우만 실행)
-- ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
