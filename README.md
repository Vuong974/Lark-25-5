# Lark Base Operations

Cong cu CLI cuc bo de quan ly Lark Base/Bitable va tao bao cao van hanh.

## 1. Cau hinh Lark

1. Tao Custom App trong Lark Developer Console.
2. Lay `App ID` va `App Secret`.
3. Cap quyen cho app toi thieu:
   - Doc/ghi Lark Base/Bitable.
   - Quyen doc user/contact neu Base co cot nguoi phu trach va ban can hien thi thong tin nguoi dung.
4. Them app vao Base nhu mot collaborator co quyen edit.
5. Copy file cau hinh:

```powershell
Copy-Item .env.example .env
```

Sau do dien:

```env
LARK_APP_ID=cli_xxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
LARK_BASE_APP_TOKEN=base_app_token
LARK_TABLE_ID=table_id
LARK_REPORT_TABLE_ID=report_table_id
```

`app_token` lay tu URL cua Lark Base. `table_id` lay trong URL/table API hoac dung command `tables`.

## 2. Lenh co ban

Kiem tra token:

```powershell
npm run lark -- token
```

Lay danh sach table trong Base:

```powershell
npm run lark -- tables --appToken <base_app_token>
```

Lay field cua table:

```powershell
npm run lark -- fields --appToken <base_app_token> --tableId <table_id>
```

Doc record:

```powershell
npm run lark -- records --appToken <base_app_token> --tableId <table_id>
```

Tao record:

```powershell
npm run lark -- create-record --appToken <base_app_token> --tableId <table_id> --fields '{"Ten":"Cong viec A","Trang thai":"Dang lam"}'
```

Sua truc tiep mot record:

```powershell
npm run lark -- update-record --appToken <base_app_token> --tableId <table_id> --recordId <record_id> --fields '{"Trang thai":"Hoan thanh"}'
```

Sua nhieu record:

```powershell
npm run lark -- batch-update --appToken <base_app_token> --tableId <table_id> --records '[{"record_id":"recxxx","fields":{"Trang thai":"Hoan thanh"}}]'
```

## 3. Bao cao van hanh

Tao file bao cao Markdown trong thu muc `reports/`:

```powershell
npm run lark -- report --appToken <base_app_token> --tableId <table_id> --title "Bao cao van hanh ngay" --statusField "Trang thai" --ownerField "Phu trach" --dateField "Ngay"
```

Ghi bao cao vao mot table tren Lark Base:

```powershell
npm run lark -- create-report-record --sourceAppToken <base_app_token> --sourceTableId <source_table_id> --reportAppToken <base_app_token> --reportTableId <report_table_id> --title "Bao cao van hanh ngay" --titleField "Tieu de" --contentField "Noi dung" --statusField "Trang thai" --ownerField "Phu trach"
```

## 4. Ghi chu

- Lark `tenant_access_token` duoc cache trong `.lark-token-cache.json` va khong commit len git.
- Ten field trong JSON phai trung voi ten cot tren Lark Base.
- Neu API tra 403, hay kiem tra app da duoc cap quyen API va da co quyen edit tren Base.
