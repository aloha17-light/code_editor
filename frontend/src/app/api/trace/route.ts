import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Proxy the execution trace request to our actual Node.js/Python backend
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    const res = await axios.post(
      `${BACKEND_URL}/submissions/trace`,
      { sourceCode: code },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        trace: res.data.data, // This maps to the trace JSON array emitted by sys.settrace
      }
    });

  } catch (error: any) {
    console.error("Visualizer API Error:", error.response?.data || error.message);
    const apiError = error.response?.data?.message || error.message || 'Execution failed';
    return NextResponse.json({ error: apiError }, { status: error.response?.status || 500 });
  }
}

