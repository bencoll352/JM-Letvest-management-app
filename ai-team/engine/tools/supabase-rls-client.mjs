// RLS-protected Supabase RPC client for JM Letvest AI Employees.
// Strictly uses public anon/publishable key + dedicated manager account JWT.
// NEVER permits a service_role key.

function decodeJwtPayload(jwt) {
  if (typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function assertNotServiceRoleKey(keyOrToken, label = 'key') {
  if (!keyOrToken || typeof keyOrToken !== 'string') {
    throw new Error(`Missing Supabase ${label}`);
  }
  const trimmed = keyOrToken.trim();
  if (
    trimmed.startsWith('sb_secret_') ||
    trimmed.startsWith('sbp_') ||
    /service_role/i.test(trimmed)
  ) {
    throw Object.assign(
      new Error('Security policy violation: service_role or secret keys are strictly forbidden. Use an RLS-protected manager account.'),
      { code: 'SERVICE_ROLE_FORBIDDEN', status: 403 }
    );
  }
  const payload = decodeJwtPayload(trimmed);
  if (payload && payload.role === 'service_role') {
    throw Object.assign(
      new Error('Security policy violation: JWT carries role=service_role. Use an RLS-protected manager account.'),
      { code: 'SERVICE_ROLE_FORBIDDEN', status: 403 }
    );
  }
}

export class SupabaseRlsClient {
  constructor(options = {}) {
    const env = options.env || process.env;
    this.url = (options.url || env.SUPABASE_URL || '').replace(/\/+$/, '');
    this.anonKey = options.anonKey || env.SUPABASE_ANON_KEY || '';
    this.managerEmail = options.managerEmail || env.JM_LETVEST_MANAGER_EMAIL || '';
    this.managerPassword = options.managerPassword || env.JM_LETVEST_MANAGER_PASSWORD || '';
    this.fetchImpl = options.fetchImpl || fetch;
    this.accessToken = options.accessToken || null;

    if (this.anonKey) {
      assertNotServiceRoleKey(this.anonKey, 'anonKey');
    }
    if (this.accessToken) {
      assertNotServiceRoleKey(this.accessToken, 'accessToken');
    }
  }

  async authenticateManager() {
    if (this.accessToken) {
      assertNotServiceRoleKey(this.accessToken, 'accessToken');
      return this.accessToken;
    }
    if (!this.url || !this.anonKey || !this.managerEmail || !this.managerPassword) {
      throw Object.assign(
        new Error('Supabase RLS manager credentials are not configured in environment variables'),
        { code: 'MISSING_SUPABASE_CONFIG' }
      );
    }
    assertNotServiceRoleKey(this.anonKey, 'anonKey');

    const res = await this.fetchImpl(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email: this.managerEmail,
        password: this.managerPassword
      })
    });

    if (!res.ok) {
      throw new Error(`Supabase manager authentication failed with status ${res.status}`);
    }
    const data = await res.json();
    if (!data?.access_token) {
      throw new Error('Supabase authentication response did not include an access_token');
    }
    assertNotServiceRoleKey(data.access_token, 'accessToken');
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async rpc(functionName, params = {}) {
    const token = await this.authenticateManager();
    const res = await this.fetchImpl(`${this.url}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      throw Object.assign(new Error(`Supabase RPC ${functionName} failed with status ${res.status}`), {
        status: res.status
      });
    }
    return await res.json();
  }
}
