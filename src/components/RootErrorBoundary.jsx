import React from 'react';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a tiny diagnostic trail in console for local debugging.
    // eslint-disable-next-line no-console
    console.error('[RootErrorBoundary]', error, info);
  }

  handleReset = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.location.reload();
      }
    } catch (_) {}
  };

  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || 'Errore non identificato');
    const stackLines = String(this.state.error?.stack || '')
      .split('\n')
      .slice(0, 6)
      .join('\n');
    return (
      <div style={{
        minHeight: '100vh',
        background: '#030507',
        color: '#e5e7eb',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto', border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(127,29,29,0.15)', padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fca5a5' }}>Runtime Error</p>
          <h1 style={{ margin: '8px 0 10px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Schermata di sicurezza attiva</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#fecaca' }}>{message}</p>
          {stackLines ? (
            <pre style={{
              marginTop: 12,
              marginBottom: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 11,
              color: '#fca5a5',
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(248,113,113,0.25)',
              padding: 10
            }}>
              {stackLines}
            </pre>
          ) : null}
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 14,
              padding: '10px 12px',
              border: '1px solid rgba(248,113,113,0.55)',
              background: 'rgba(0,0,0,0.5)',
              color: '#fca5a5',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer'
            }}
          >
            Reset Local Data
          </button>
        </div>
      </div>
    );
  }
}

export default RootErrorBoundary;
