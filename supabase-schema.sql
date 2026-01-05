-- ============================================
-- 家庭图书管理系统 - Supabase 数据库表结构
-- ============================================
-- 使用说明：
-- 1. 登录 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制粘贴下方全部代码并执行
-- ============================================

-- 创建 books 表
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn VARCHAR UNIQUE NOT NULL,      -- ISBN 码，唯一索引用于查重
  title VARCHAR NOT NULL,            -- 书名
  author VARCHAR,                    -- 作者
  publisher VARCHAR,                 -- 出版社
  cover_url TEXT,                    -- 封面图链接（API 返回的外链或 Supabase Storage 路径）
  summary TEXT,                      -- 简介
  quantity INTEGER DEFAULT 1,        -- 持有本数
  source VARCHAR DEFAULT 'api',      -- 数据来源：'api'（自动抓取）/ 'manual'（手动录入）
  is_pending BOOLEAN DEFAULT false,  -- 待处理状态：true 表示信息不完整需要人工处理
  error_reason VARCHAR,              -- 失败原因记录（API无结果/网络超时/额度耗尽等）
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- 首次扫描时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()   -- 最后更新时间
);

-- 为待处理状态创建索引，加速异常列表查询
CREATE INDEX idx_books_pending ON books(is_pending) WHERE is_pending = true;

-- 为 ISBN 创建索引，加速查重和搜索
CREATE INDEX idx_books_isbn ON books(isbn);

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 验证表结构
COMMENT ON TABLE books IS '家庭图书馆藏书表';
COMMENT ON COLUMN books.isbn IS 'ISBN 唯一码（10 位或 13 位）';
COMMENT ON COLUMN books.quantity IS '持有数量（支持同一 ISBN 多本）';
COMMENT ON COLUMN books.is_pending IS '待处理标记（影子记录策略核心字段）';
COMMENT ON COLUMN books.error_reason IS 'API 抓取失败原因（用于异常排查）';
