const getApiBase = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://api:4000';
  }
  return '';
};
const API_BASE = getApiBase();

// ─── Auth Functions ─────────────────────────────────────────────────

export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('worksync_device_token');
  if (!token) {
    token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('worksync_device_token', token);
  }
  return token;
}

export async function login(
  identifier: string,
  password: string,
  authType: 'ad' | 'local' = 'local',
  botDefense?: {
    corporate_fax?: string;
    security_honey?: string;
    form_render_ts?: number;
  },
) {
  const device_token = getOrCreateDeviceToken();
  
  // NestJS backend accepts username or email in the email field.
  const payload: any = {
    email: identifier,
    password,
    device_token,
    auth_type: authType,
  };

  if (botDefense) {
    if (botDefense.corporate_fax) payload.corporate_fax = botDefense.corporate_fax;
    if (botDefense.security_honey) payload.security_honey = botDefense.security_honey;
    if (botDefense.form_render_ts) payload.form_render_ts = botDefense.form_render_ts;
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorMsg = 'เข้าสู่ระบบไม่สำเร็จ';
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await res.json();
        errorMsg = error.detail || error.message || error.errors?.[0]?.message || errorMsg;
      } else {
        const text = await res.text();
        if (text) errorMsg = text;
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  
  // Save last logged in username for PIN lookup
  if (typeof window !== 'undefined' && data.data) {
    // Keep username clean from display formatting
    const rawUsername = identifier; 
    localStorage.setItem('worksync_last_username', rawUsername);
  }
  
  return data.data;
}

export async function changeLocalPassword(oldPassword: string, newPassword: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authToken = token || getAuthToken();
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}/auth/local/change-password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });

  if (!res.ok) {
    let errorMsg = 'เปลี่ยนรหัสผ่านไม่สำเร็จ';
    try {
      const error = await res.json();
      errorMsg = error.message || error.detail || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return await res.json();
}

export async function loginPin(username: string, pin: string, deviceToken: string) {
  const res = await fetch(`${API_BASE}/auth/login-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin_code: pin, device_token: deviceToken }),
  });

  if (!res.ok) {
    let errorMsg = 'เข้าสู่ระบบด้วย PIN ไม่สำเร็จ';
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await res.json();
        errorMsg = error.message || error.errors?.[0]?.message || errorMsg;
      } else {
        const text = await res.text();
        if (text) errorMsg = text;
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  return data.data;
}

export async function refreshToken(refreshToken: string) {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) throw new Error('Refresh token invalid');
  const data = await res.json();
  return data.data;
}

export async function getMe(token: string) {
  const res = await fetch(`${API_BASE}/users/me?fields=id,username,first_name,role,department,nickname`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const isLoginPage = window.location.pathname === '/login';
    const isAuthCallback = window.location.pathname === '/auth/callback';
    if (!isLoginPage && !isAuthCallback) {
      logout();
    }
  }

  if (!res.ok) throw new Error('Invalid token');
  const data = await res.json();
  return data.data;
}

export function logout() {
  const authProvider = typeof window !== 'undefined' ? localStorage.getItem('app_auth_provider') : null;
  const ciamPortalUrl =
    (typeof window !== 'undefined' && localStorage.getItem('app_ciam_portal_url')) ||
    'https://ciam.windowasia.com/portal';

  document.cookie = 'directus_token=; path=/; max-age=0';
  document.cookie = 'directus_refresh=; path=/; max-age=0';
  document.cookie = 'directus_username=; path=/; max-age=0';
  document.cookie = 'directus_first_name=; path=/; max-age=0';

  if (typeof window !== 'undefined') {
    localStorage.removeItem('app_auth_provider');
  }

  if (authProvider === 'local') {
    window.location.href = '/login';
  } else {
    window.location.href = ciamPortalUrl;
  }
}

// ─── Admin Functions ────────────────────────────────────────────────

export const admin = {
  async getUsers(token: string) {
    const res = await fetch(
      `${API_BASE}/users?fields=id,email,username,first_name,last_name,status,role.name,role.id,department,position,manager,colleagues,is_ad_auth`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data;
  },

  async createUser(
    token: string,
    userData: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      username: string;
      role?: string;
      manager?: string;
      colleagues?: string[];
      telegram_id?: string;
      is_ad_auth?: boolean;
    }
  ) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'สร้างผู้ใช้ไม่สำเร็จ');
    }
    const data = await res.json();
    return data;
  },

  async updateUser(token: string, userId: string, updates: any) {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'แก้ไขข้อมูลไม่สำเร็จ');
    }
    const data = await res.json();
    return data;
  },

  async deleteUser(token: string, userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  },

  async getLoginLogs(token: string) {
    const res = await fetch(`${API_BASE}/auth/login-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลประวัติการเข้าใช้งานได้');
    }
    const data = await res.json();
    return data;
  },

  async getCiamSettings(token: string) {
    const res = await fetch(`${API_BASE}/settings/ciam-sso`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลการตั้งค่า Central IAM ได้');
    }
    return await res.json();
  },

  async updateCiamSettings(token: string, settings: any) {
    const res = await fetch(`${API_BASE}/settings/ciam-sso`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'บันทึกการตั้งค่า Central IAM ไม่สำเร็จ');
    }
    return await res.json();
  },

  async testCiamConnection(token: string) {
    const res = await fetch(`${API_BASE}/settings/ciam-sso/test-connection`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'ทดสอบการเชื่อมต่อไม่สำเร็จ');
    }
    return await res.json();
  },

  async getSmtpSettings(token: string) {
    const res = await fetch(`${API_BASE}/settings/smtp`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลการตั้งค่า SMTP ได้');
    }
    return await res.json();
  },

  async updateSmtpSettings(token: string, settings: any) {
    const res = await fetch(`${API_BASE}/settings/smtp`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'บันทึกการตั้งค่า SMTP ไม่สำเร็จ');
    }
    return await res.json();
  },

  async testSmtpConnection(token: string, recipient: string) {
    const res = await fetch(`${API_BASE}/settings/smtp/test`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'ส่งอีเมลทดสอบไม่สำเร็จ');
    }
    return data;
  },

  async toggleBreakGlass(token: string, breakGlassActive: boolean, reason: string) {
    const res = await fetch(`${API_BASE}/auth/sso/break-glass-toggle`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ break_glass_active: breakGlassActive, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'สลับโหมด Break-Glass ไม่สำเร็จ');
    }
    return await res.json();
  },

  async getCiamLogs(token: string, category = 'ciam_sso', limit = 50) {
    const res = await fetch(`${API_BASE}/settings/ciam-sso/logs?category=${encodeURIComponent(category)}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('ไม่สามารถดึงข้อมูล Transaction Logs ได้');
    }
    return await res.json();
  },

  // ─── AI Copilot Admin Methods (Section 11 / v2.8.0 / v2.12.0) ───────────
  async getAiSettings(token: string) {
    const res = await fetch(`${API_BASE}/settings/ai`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลการตั้งค่า AI Copilot ได้');
    }
    return await res.json();
  },

  async updateAiSettings(token: string, settings: any) {
    const res = await fetch(`${API_BASE}/settings/ai`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'บันทึกการตั้งค่า AI Copilot ไม่สำเร็จ');
    }
    return await res.json();
  },

  async testAiConnection(token: string) {
    const res = await fetch(`${API_BASE}/settings/ai/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'ทดสอบเชื่อมต่อ AI API ไม่สำเร็จ');
    }
    return await res.json();
  },
};

// ─── SSO Public Functions ───────────────────────────────────────────

export async function getSsoConfig() {
  try {
    const res = await fetch(`${API_BASE}/auth/sso/config?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) {
      return {
        sso_enabled: false,
        break_glass_active: false,
        ciam_base_url: '',
        client_id: '',
        login_button_label: 'เข้าสู่ระบบด้วย Central IAM (SSO)',
        fallback_ad_available: true,
      };
    }
    const data = await res.json();
    return {
      ...data,
      sso_enabled: data.sso_enabled === true || data.sso_enabled === 'true',
      break_glass_active: data.break_glass_active === true || data.break_glass_active === 'true',
    };
  } catch {
    return {
      sso_enabled: false,
      break_glass_active: false,
      ciam_base_url: '',
      client_id: '',
      login_button_label: 'เข้าสู่ระบบด้วย Central IAM (SSO)',
      fallback_ad_available: true,
    };
  }
}


export async function getSsoAuthorizeUrl(redirectUri: string) {
  const res = await fetch(`${API_BASE}/auth/sso/authorize-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uri: redirectUri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'ไม่สามารถขอ Authorize URL จากระบบได้');
  }
  return await res.json();
}

export async function ssoCallback(code: string, codeVerifier: string, redirectUri: string) {
  const res = await fetch(`${API_BASE}/auth/sso/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'การยืนยันตัวตน SSO ล้มเหลว');
  }
  return await res.json();
}


// ─── Cookie Helpers ─────────────────────────────────────────────────

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function getAuthToken(): string | null {
  return getCookie('directus_token');
}

export function getAuthUsername(): string | null {
  return getCookie('directus_username');
}

export function getAuthFirstName(): string | null {
  return getCookie('directus_first_name');
}

export function getRefreshToken(): string | null {
  return getCookie('directus_refresh');
}

export function formatUserDisplayName(user: any): string {
  if (!user) return '-';
  const nick = user.nickname ? `${user.nickname} ` : '';
  const first = user.first_name || user.username || '';
  const dept = user.department || 'IT';
  return `${nick}(${first})/${dept}`;
}
