import { getTransporter } from '@/lib/mailer';
import { NextResponse } from 'next/server';

// POST - test Gmail connection
export async function POST() {
  try {
    const { transporter } = await getTransporter();
    await transporter.verify();
    return NextResponse.json({ success: true, message: 'Gmail connection successful!' });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `Connection failed: ${errorMsg}` },
      { status: 400 }
    );
  }
}
