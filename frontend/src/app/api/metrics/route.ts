import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Metrics unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}