import React, { useState, useEffect, useCallback } from 'react';
import { generatePassword } from '../../services/credential.api.js';
import { KeyRound, Copy, Check, RefreshCw, X, Sparkles } from 'lucide-react';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (password: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [length, setLength] = useState<number>(18);
  const [uppercase, setUppercase] = useState<boolean>(true);
  const [lowercase, setLowercase] = useState<boolean>(true);
  const [numbers, setNumbers] = useState<boolean>(true);
  const [symbols, setSymbols] = useState<boolean>(true);
  const [generated, setGenerated] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchNewPassword = useCallback(async () => {
    if (!uppercase && !lowercase && !numbers && !symbols) return;
    setLoading(true);
    try {
      const data = await generatePassword({
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
      });
      setGenerated(data.password);
    } catch (err) {
      console.error('Password generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [length, uppercase, lowercase, numbers, symbols]);

  useEffect(() => {
    if (isOpen) {
      fetchNewPassword();
    }
  }, [isOpen, fetchNewPassword]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onApply(generated);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="var(--purple)" />
            <h3 className="modal-title">Password Generator</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.2rem' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Generated Output Box */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.95rem',
                letterSpacing: '0.5px',
                wordBreak: 'break-all',
                color: 'var(--info)',
                fontWeight: 600,
              }}
            >
              {loading ? 'Generating...' : generated}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchNewPassword}
                title="Regenerate"
                disabled={loading}
                style={{ padding: '0.35rem 0.5rem' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
              </button>
              <button
                className={`btn btn-sm ${copied ? 'btn-primary' : 'btn-secondary'}`}
                onClick={handleCopy}
                title="Copy to Clipboard"
                style={{ padding: '0.35rem 0.5rem' }}
              >
                {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Length Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="form-label">Password Length</label>
                <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
                  {length} Chars
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={length}
                onChange={(e) => setLength(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>

            {/* Character Group Checkboxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={uppercase}
                  onChange={(e) => setUppercase(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Uppercase (A-Z)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={lowercase}
                  onChange={(e) => setLowercase(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Lowercase (a-z)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={numbers}
                  onChange={(e) => setNumbers(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Numbers (0-9)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={symbols}
                  onChange={(e) => setSymbols(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Symbols (!@#$%)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleApply} disabled={!generated}>
            <KeyRound size={13} />
            Use Password
          </button>
        </div>
      </div>
    </div>
  );
};
