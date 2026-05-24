#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LarkClient, loadDotenv } from './larkClient.js';

loadDotenv();

const [, , command = 'help', ...argv] = process.argv;

function parseArgs(args) {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? args[i + 1];
    if (inlineValue === undefined && value && !value.startsWith('--')) i += 1;
    parsed[rawKey] = value === undefined || value.startsWith('--') ? true : value;
  }
  return parsed;
}

function required(value, name) {
  if (!value) throw new Error(`Missing ${name}. Pass --${name} or set the matching value in .env.`);
  return value;
}

function defaults(args) {
  return {
    appToken: args.appToken || process.env.LARK_BASE_APP_TOKEN,
    tableId: args.tableId || process.env.LARK_TABLE_ID
  };
}

function parseJson(input, label) {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`${label} must be valid JSON. ${error.message}`);
  }
}

function fieldFromArgs(args) {
  const field = {
    field_name: required(args.name, 'name'),
    type: Number(args.type || 1)
  };
  if (args.property) field.property = parseJson(args.property, '--property');
  if (args.options) {
    field.property = {
      options: String(args.options)
        .split(',')
        .map((name) => ({ name: name.trim() }))
        .filter((option) => option.name)
    };
  }
  return field;
}

function asRows(records) {
  return (records || []).map((item) => ({
    record_id: item.record_id,
    ...item.fields
  }));
}

function buildReport(records, { title = 'Bao cao van hanh', statusField, ownerField, dateField } = {}) {
  const now = new Date();
  const rows = asRows(records);
  const lines = [
    `# ${title}`,
    '',
    `Thoi gian tao: ${now.toLocaleString('vi-VN')}`,
    `Tong so record: ${rows.length}`,
    ''
  ];

  if (statusField) {
    const byStatus = new Map();
    for (const row of rows) byStatus.set(row[statusField] ?? '(trong)', (byStatus.get(row[statusField] ?? '(trong)') || 0) + 1);
    lines.push('## Theo trang thai', '');
    for (const [status, count] of byStatus.entries()) lines.push(`- ${status}: ${count}`);
    lines.push('');
  }

  if (ownerField) {
    const byOwner = new Map();
    for (const row of rows) {
      const owner = Array.isArray(row[ownerField]) ? row[ownerField].map((x) => x.name || x.id || x).join(', ') : row[ownerField];
      byOwner.set(owner || '(chua gan)', (byOwner.get(owner || '(chua gan)') || 0) + 1);
    }
    lines.push('## Theo phu trach', '');
    for (const [owner, count] of byOwner.entries()) lines.push(`- ${owner}: ${count}`);
    lines.push('');
  }

  if (dateField) {
    const dated = rows.filter((row) => row[dateField]).length;
    lines.push('## Du lieu thoi gian', '', `- Co ${dateField}: ${dated}`, `- Thieu ${dateField}: ${rows.length - dated}`, '');
  }

  lines.push('## Du lieu chi tiet', '');
  for (const row of rows.slice(0, 20)) {
    const recordId = row.record_id;
    const summary = Object.entries(row)
      .filter(([key]) => key !== 'record_id')
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('; ');
    lines.push(`- ${recordId}: ${summary}`);
  }
  if (rows.length > 20) lines.push(`- ... con ${rows.length - 20} record`);

  return lines.join('\n');
}

function help() {
  console.log(`Lark Base CLI

Setup:
  Copy .env.example to .env and fill LARK_APP_ID, LARK_APP_SECRET.
  Add your Lark app as a collaborator/editor to the target Base.

Commands:
  npm run lark -- token
  npm run lark -- tables --appToken <base_app_token>
  npm run lark -- create-table --appToken <base_app_token> --name "SEO KNA"
  npm run lark -- fields --appToken <base_app_token> --tableId <table_id>
  npm run lark -- create-field --appToken <base_app_token> --tableId <table_id> --name "note vượng" --type 1
  npm run lark -- update-field --appToken <base_app_token> --tableId <table_id> --fieldId <field_id> --name "Từ khóa" --type 1
  npm run lark -- records --appToken <base_app_token> --tableId <table_id>
  npm run lark -- create-record --appToken <base_app_token> --tableId <table_id> --fields '{"Ten":"A"}'
  npm run lark -- update-record --appToken <base_app_token> --tableId <table_id> --recordId <record_id> --fields '{"Trang thai":"Done"}'
  npm run lark -- report --appToken <base_app_token> --tableId <table_id> --statusField "Trang thai" --ownerField "Phu trach"
  npm run lark -- create-report-record --appToken <base_app_token> --tableId <report_table_id> --title "Bao cao ngay" --contentField "Noi dung"
`);
}

async function main() {
  const args = parseArgs(argv);
  const { appToken, tableId } = defaults(args);

  if (command === 'help') return help();

  const client = new LarkClient();

  if (command === 'token') {
    console.log(await client.getTenantAccessToken());
    return;
  }

  if (command === 'tables') {
    console.log(JSON.stringify(await client.listTables(required(appToken, 'appToken')), null, 2));
    return;
  }

  if (command === 'create-table') {
    const table = {
      name: required(args.name, 'name')
    };
    if (args.defaultViewName) table.default_view_name = args.defaultViewName;
    if (args.fields) table.fields = parseJson(args.fields, '--fields');
    console.log(JSON.stringify(await client.createTable(required(appToken, 'appToken'), table), null, 2));
    return;
  }

  if (command === 'fields') {
    console.log(JSON.stringify(await client.listFields(required(appToken, 'appToken'), required(tableId, 'tableId')), null, 2));
    return;
  }

  if (command === 'create-field') {
    const field = fieldFromArgs(args);
    console.log(JSON.stringify(await client.createField(required(appToken, 'appToken'), required(tableId, 'tableId'), field), null, 2));
    return;
  }

  if (command === 'update-field') {
    const field = fieldFromArgs(args);
    console.log(JSON.stringify(await client.updateField(required(appToken, 'appToken'), required(tableId, 'tableId'), required(args.fieldId, 'fieldId'), field), null, 2));
    return;
  }

  if (command === 'records') {
    const data = await client.listRecords(required(appToken, 'appToken'), required(tableId, 'tableId'), {
      pageSize: args.pageSize || 100,
      viewId: args.viewId
    });
    console.table(asRows(data.items));
    return;
  }

  if (command === 'create-record') {
    const fields = parseJson(required(args.fields, 'fields'), '--fields');
    console.log(JSON.stringify(await client.createRecord(required(appToken, 'appToken'), required(tableId, 'tableId'), fields), null, 2));
    return;
  }

  if (command === 'update-record') {
    const fields = parseJson(required(args.fields, 'fields'), '--fields');
    console.log(JSON.stringify(await client.updateRecord(required(appToken, 'appToken'), required(tableId, 'tableId'), required(args.recordId, 'recordId'), fields), null, 2));
    return;
  }

  if (command === 'batch-update') {
    const records = parseJson(required(args.records, 'records'), '--records');
    console.log(JSON.stringify(await client.batchUpdateRecords(required(appToken, 'appToken'), required(tableId, 'tableId'), records), null, 2));
    return;
  }

  if (command === 'report' || command === 'create-report-record') {
    const sourceAppToken = required(args.sourceAppToken || appToken, 'appToken');
    const sourceTableId = required(args.sourceTableId || tableId, 'tableId');
    const data = await client.listRecords(sourceAppToken, sourceTableId, {
      pageSize: args.pageSize || 100,
      viewId: args.viewId
    });
    const report = buildReport(data.items, {
      title: args.title || 'Bao cao van hanh',
      statusField: args.statusField,
      ownerField: args.ownerField,
      dateField: args.dateField
    });

    if (command === 'create-report-record') {
      const reportAppToken = args.reportAppToken || appToken;
      const reportTableId = args.reportTableId || process.env.LARK_REPORT_TABLE_ID || tableId;
      const titleField = args.titleField || 'Tieu de';
      const contentField = required(args.contentField, 'contentField');
      const fields = {
        [titleField]: args.title || `Bao cao van hanh ${new Date().toLocaleDateString('vi-VN')}`,
        [contentField]: report
      };
      console.log(JSON.stringify(await client.createRecord(required(reportAppToken, 'reportAppToken'), required(reportTableId, 'reportTableId'), fields), null, 2));
      return;
    }

    await mkdir('reports', { recursive: true });
    const file = path.resolve('reports', `operations-${new Date().toISOString().slice(0, 10)}.md`);
    await writeFile(file, report, 'utf8');
    console.log(file);
    return;
  }

  help();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
