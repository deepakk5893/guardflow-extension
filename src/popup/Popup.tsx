import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Send, Settings } from 'lucide-react';

interface Stats {
  secretsDetected: number;
  secretsBlocked: number;
  messagesSent: number;
}

function Popup() {
  const [stats, setStats] = useState<Stats>({
    secretsDetected: 0,
    secretsBlocked: 0,
    messagesSent: 0,
  });

  useEffect(() => {
    // Load stats from storage
    chrome.storage.local.get('stats', (result) => {
      if (result.stats) {
        setStats(result.stats);
      }
    });
  }, []);

  const protectionRate =
    stats.secretsDetected > 0
      ? Math.round((stats.secretsBlocked / stats.secretsDetected) * 100)
      : 0;

  return (
    <div style={{ background: 'white' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Shield size={24} />
          <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Guardflow</h1>
        </div>
        <p style={{ fontSize: '13px', opacity: 0.9 }}>
          AI Chat Secret Detection
        </p>
      </div>

      {/* Stats */}
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '12px' }}>
            Protection Stats
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Secrets Detected */}
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde047',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <span style={{ fontSize: '13px', color: '#92400e' }}>Secrets Detected</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#92400e' }}>
                {stats.secretsDetected}
              </span>
            </div>

            {/* Secrets Blocked */}
            <div
              style={{
                background: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="#15803d" />
                <span style={{ fontSize: '13px', color: '#15803d' }}>Secrets Blocked</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#15803d' }}>
                {stats.secretsBlocked}
              </span>
            </div>

            {/* Messages Sent */}
            <div
              style={{
                background: '#e0e7ff',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={16} color="#4338ca" />
                <span style={{ fontSize: '13px', color: '#4338ca' }}>Messages Sent</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#4338ca' }}>
                {stats.messagesSent}
              </span>
            </div>
          </div>
        </div>

        {/* Protection Rate */}
        {stats.secretsDetected > 0 && (
          <div
            style={{
              background: '#f9fafb',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Protection Rate</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                {protectionRate}%
              </span>
            </div>
            <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  height: '100%',
                  width: `${protectionRate}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Supported Sites */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
            Protected Sites
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Groq'].map((site) => (
              <span
                key={site}
                style={{
                  background: '#ede9fe',
                  color: '#6b21a8',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontWeight: 500,
                }}
              >
                {site}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <a
            href="https://guardflow.tech"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              background: '#f3f4f6',
              borderRadius: '6px',
              color: '#374151',
              fontSize: '12px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <Settings size={14} />
            Learn More About Guardflow
          </a>
          <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
            v1.0.0 • Free for individual developers
          </p>
        </div>
      </div>
    </div>
  );
}

export default Popup;
