'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: '#0d0f0c',
          color: '#f2f3ec',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>CAPNO Studio failed to load</h1>
          <p style={{ marginTop: '0.5rem', color: '#b3b6ab', fontSize: '0.875rem' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.25rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              background: '#facc15',
              color: '#1b1c17',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
