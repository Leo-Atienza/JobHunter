import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'JobHunter — Your Job Search Command Center';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Generates the Open Graph image for JobHunter.
 * Rendered at build time (or on-demand on edge) by Next.js via next/og.
 */
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#1e1b4b',
          fontFamily: 'sans-serif',
          gap: 24,
        }}
      >
        {/* Magnifying glass icon */}
        <svg
          width="96"
          height="96"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="6" fill="#312e81" />
          <circle
            cx="14"
            cy="14"
            r="6"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
          />
          <line
            x1="18.5"
            y1="18.5"
            x2="24"
            y2="24"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-2px',
            lineHeight: 1,
          }}
        >
          JobHunter
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            color: '#f59e0b',
            letterSpacing: '0.5px',
          }}
        >
          Your Job Search Command Center
        </div>
      </div>
    ),
    { ...size },
  );
}
