import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeStr } = await params;
  const size = parseInt(sizeStr, 10);
  if (![192, 512].includes(size)) {
    return new Response('Invalid size', { status: 400 });
  }

  const iconSize = Math.round(size * 0.5);
  const radius = Math.round(size * 0.19);

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: '#1e1b4b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="11" cy="11" r="6" stroke="#f59e0b" strokeWidth="2.5" fill="none" />
        <line
          x1="15.5"
          y1="15.5"
          x2="20"
          y2="20"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
