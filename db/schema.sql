CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  required_count INTEGER NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actual_count INTEGER NOT NULL,
  result TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO stores (name, code, address) VALUES
  ('北京朝阳店', 'BJ-CY-001', '北京市朝阳区建国路88号'),
  ('上海浦东店', 'SH-PD-001', '上海市浦东新区陆家嘴环路100号'),
  ('广州天河店', 'GZ-TH-001', '广州市天河区体育西路50号'),
  ('深圳南山店', 'SZ-NS-001', '深圳市南山区科技园路20号');
