-- Tìm kiếm không dấu / gần đúng (Mục 9.1, 10).
-- Cả hai extension là "trusted" từ PostgreSQL 13 → chủ sở hữu DB tự tạo được, không cần superuser.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
