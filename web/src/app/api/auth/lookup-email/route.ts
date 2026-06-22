import { NextRequest, NextResponse } from 'next/server';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'admin@waapps.net';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'admin_password_123';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // First, login as admin to get a token
    const loginRes = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DIRECTUS_EMAIL, password: DIRECTUS_PASSWORD }),
    });

    if (!loginRes.ok) {
      return NextResponse.json({ error: 'Admin auth failed' }, { status: 500 });
    }

    const loginData = await loginRes.json();
    const adminToken = loginData.data.access_token;

    // Look up user by username
    const userRes = await fetch(
      `${DIRECTUS_URL}/users?filter[username][_eq]=${encodeURIComponent(username)}&fields=id,email,username,first_name,last_name,status`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const userData = await userRes.json();

    if (!userData.data?.length) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    return NextResponse.json({ email: userData.data[0].email });
  } catch (err) {
    console.error('Email lookup error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
