-- Tìm kiếm văn bản không dấu (Mục 4.4): CSDL tự tính "searchText" = lower(unaccent(...)) mỗi khi ghi,
-- để mọi đường ghi (form, seed, nhập liệu) nhất quán với cách chuẩn hoá từ khoá (unaccent ở câu truy vấn).
-- Gồm: số ký hiệu, TÊN LOẠI văn bản (để "quyet dinh …" khớp văn bản loại Quyết định), trích yếu,
-- tóm tắt (bỏ thẻ HTML), người ký, cơ quan ban hành nhập tự do, thẻ.
CREATE OR REPLACE FUNCTION document_node_search_text() RETURNS trigger AS $$
BEGIN
  NEW."searchText" := lower(unaccent(concat_ws(' ',
    NEW."number",
    (SELECT t."name" FROM "DocumentType" t WHERE t."id" = NEW."typeId"),
    NEW."title",
    replace(regexp_replace(coalesce(NEW."summary", ''), '<[^>]*>', ' ', 'g'), '&nbsp;', ' '),
    NEW."signer",
    NEW."issuingAgencyText",
    array_to_string(NEW."tags", ' ')
  )));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_node_search_text
  BEFORE INSERT OR UPDATE OF "number", "typeId", "title", "summary", "signer", "issuingAgencyText", "tags"
  ON "DocumentNode"
  FOR EACH ROW EXECUTE FUNCTION document_node_search_text();

-- Tính lại cho dữ liệu đã có
UPDATE "DocumentNode" SET "title" = "title";
