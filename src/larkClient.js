import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://open.larksuite.com/open-apis';
const TOKEN_CACHE = path.resolve('.lark-token-cache.json');

export function loadDotenv(file = '.env') {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

async function readCache() {
  try {
    return JSON.parse(await readFile(TOKEN_CACHE, 'utf8'));
  } catch {
    return null;
  }
}

async function writeCache(cache) {
  await writeFile(TOKEN_CACHE, JSON.stringify(cache, null, 2));
}

export class LarkClient {
  constructor({ appId, appSecret } = {}) {
    this.appId = appId || process.env.LARK_APP_ID;
    this.appSecret = appSecret || process.env.LARK_APP_SECRET;
    if (!this.appId || !this.appSecret) {
      throw new Error('Missing LARK_APP_ID or LARK_APP_SECRET. Copy .env.example to .env and fill the values.');
    }
  }

  async getTenantAccessToken() {
    const cached = await readCache();
    const now = Math.floor(Date.now() / 1000);
    if (cached?.tenant_access_token && cached.expires_at - now > 300) {
      return cached.tenant_access_token;
    }

    const data = await this.raw('/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      auth: false,
      body: {
        app_id: this.appId,
        app_secret: this.appSecret
      }
    });

    const token = data.tenant_access_token;
    await writeCache({
      tenant_access_token: token,
      expires_at: now + Number(data.expire || 7200)
    });
    return token;
  }

  async raw(endpoint, { method = 'GET', body, auth = true, query } = {}) {
    const url = new URL(`${API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const headers = {
      'Content-Type': 'application/json; charset=utf-8'
    };
    if (auth) headers.Authorization = `Bearer ${await this.getTenantAccessToken()}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok || json.code !== 0) {
      const message = json.msg || response.statusText;
      throw new Error(`Lark API failed ${response.status} code=${json.code ?? 'n/a'}: ${message}`);
    }
    return json.data ?? json;
  }

  listTables(appToken) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`, {
      query: { page_size: 100 }
    });
  }

  createTable(appToken, table) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`, {
      method: 'POST',
      body: { table }
    });
  }

  listFields(appToken, tableId) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields`, {
      query: { page_size: 100 }
    });
  }

  createField(appToken, tableId, field) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields`, {
      method: 'POST',
      body: field
    });
  }

  updateField(appToken, tableId, fieldId, field) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(fieldId)}`, {
      method: 'PUT',
      body: field
    });
  }

  listRecords(appToken, tableId, { pageSize = 100, pageToken, viewId, filter } = {}) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/search`, {
      method: 'POST',
      query: { page_size: pageSize, page_token: pageToken },
      body: {
        view_id: viewId || undefined,
        filter: filter || undefined
      }
    });
  }

  createRecord(appToken, tableId, fields) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`, {
      method: 'POST',
      body: { fields }
    });
  }

  updateRecord(appToken, tableId, recordId, fields) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      body: { fields }
    });
  }

  batchUpdateRecords(appToken, tableId, records) {
    return this.raw(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_update`, {
      method: 'POST',
      body: { records }
    });
  }
}
