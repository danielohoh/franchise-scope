-- ============================================================
-- 004_consultation.sql
-- AI 창업 상담 기능: 상담 링크 / 세션 / 채팅 / 지식베이스(FAQ)
-- ============================================================

-- 1. 상담 링크 (본사 담당자가 발급)
CREATE TABLE IF NOT EXISTS consultation_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id     UUID        NOT NULL,                   -- brands 테이블 FK (앱에서 관리)
  token        TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label        TEXT,                                   -- 내부 메모 (예: "4월 박람회 문의자")
  expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  status       TEXT        NOT NULL DEFAULT 'active',  -- active | expired | closed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_links_user    ON consultation_links(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_links_token   ON consultation_links(token);
CREATE INDEX IF NOT EXISTS idx_consultation_links_status  ON consultation_links(status);

-- 2. 상담 세션 (예비 점주가 링크로 접속 시 생성)
CREATE TABLE IF NOT EXISTS consultation_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id                 UUID        NOT NULL REFERENCES consultation_links(id) ON DELETE CASCADE,
  prospect_id             UUID,                        -- prospects 테이블 FK (앱에서 관리)
  contact_name            TEXT,                        -- 점주 입력 이름
  contact_phone           TEXT,                        -- 점주 입력 휴대폰
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_data          JSONB,                       -- AI 파싱된 구조화 정보
  status                  TEXT        NOT NULL DEFAULT 'active',  -- active | completed
  callback_requested      BOOLEAN     NOT NULL DEFAULT false,
  callback_preferred_time TEXT
);

CREATE INDEX IF NOT EXISTS idx_consultation_sessions_link        ON consultation_sessions(link_id);
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_phone       ON consultation_sessions(contact_phone);
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_last_active ON consultation_sessions(last_active_at DESC);

-- 3. 채팅 메시지
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

-- 4. 지식베이스 (FAQ 문서 — 브랜드별)
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL,                    -- brands 테이블 FK (앱에서 관리)
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,                    -- 추출된 텍스트 전문
  file_name   TEXT,                                    -- 원본 파일명
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_brand ON knowledge_docs(brand_id);

-- ============================================================
-- RLS 정책
-- ============================================================

ALTER TABLE consultation_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_docs        ENABLE ROW LEVEL SECURITY;

-- consultation_links: 본사 담당자 자신의 링크만 CRUD
CREATE POLICY "links_own" ON consultation_links FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- consultation_sessions: 본사 담당자는 자신의 링크에 연결된 세션 조회 가능
CREATE POLICY "sessions_hq_read" ON consultation_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_links cl
      WHERE cl.id = link_id AND cl.user_id = auth.uid()
    )
  );

-- chat_messages: 본사 담당자는 자신의 세션의 메시지 조회 가능
CREATE POLICY "messages_hq_read" ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_sessions cs
      JOIN consultation_links cl ON cl.id = cs.link_id
      WHERE cs.id = session_id AND cl.user_id = auth.uid()
    )
  );

-- knowledge_docs: 본사 담당자 자신의 문서만 CRUD
CREATE POLICY "knowledge_own" ON knowledge_docs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
