import { useState } from 'preact/hooks';
import { Eye, KeyRound, Lock, ShieldCheck, WifiOff, HardDrive } from 'lucide-react';
import { passStrength, val } from './util';
import { Confirm } from './Dialog';

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><Eye /></span>;
}

function Preview() {
  // Purely decorative, contains no user data.
  const cols = [[1, 0, 0, 1], [0, 0, 1], [0, 1, 0, 0], [0, 0]];
  return (
    <div className="preview" aria-hidden="true">
      {cols.map((c, i) => (
        <div className="pv-col" key={i}>
          <div className="pv-h" />
          {c.map((hot, j) => <div key={j} className={`pv-card${hot ? ' hot' : ''}`}><i /><i /><i /></div>)}
        </div>
      ))}
    </div>
  );
}

interface Props {
  mode: 'setup' | 'unlock';
  onSubmit: (pass: string) => Promise<void>;
  onWipe: () => Promise<void>;
  storageError?: string;
}

export function Gate({ mode, onSubmit, onWipe, storageError }: Props) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [wipe, setWipe] = useState(false);
  const strength = passStrength(pass);
  const setup = mode === 'setup';

  const submit = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (setup && pass.length < 12) return setError('Use at least 12 characters.');
    if (setup && pass !== confirm) return setError('The two passphrases do not match.');
    setBusy(true);
    try {
      await onSubmit(pass);
    } catch {
      setError(setup ? 'Could not create the encrypted vault. Check browser storage permissions.' : 'That passphrase did not open the vault.');
      setShake((n) => n + 1);
      setPass('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="gate">
      <section className="gate-art">
        <div className="brand"><BrandMark /> Social Watch</div>
        <div className="gate-head">
          <h1>Every comment,<br />watched from <em>your</em> desk.</h1>
          <p>A column desk for moderating Facebook Pages and Instagram. Your tokens and history stay encrypted on this device and never touch anyone else's server.</p>
          <Preview />
        </div>
        <div className="gate-foot">
          <span><ShieldCheck /> AES-GCM, 600k PBKDF2 rounds</span>
          <span><HardDrive /> Stored only in this browser</span>
          <span><WifiOff /> No analytics, no telemetry</span>
        </div>
      </section>
      <section className="gate-form">
        <form key={shake} className={`gate-card${shake ? ' shake' : ''}`} onSubmit={submit} data-testid="form-gate">
          <h2>{setup ? 'Set a passphrase' : 'Unlock your desk'}</h2>
          <p>{setup
            ? 'It derives the key that encrypts everything here. There is no recovery: forget it and the only way back is wiping this device.'
            : 'Enter the passphrase for this device. Sessions lock automatically when idle.'}</p>
          <label className="field">
            <span>Passphrase</span>
            <input className="input" type="password" autoComplete={setup ? 'new-password' : 'current-password'} autoFocus
              value={pass} onInput={(e) => setPass(val(e))} aria-invalid={!!error} data-testid="input-passphrase" />
          </label>
          {setup && <>
            <div className="meter" data-s={strength} aria-label={`Strength ${strength} of 4`}><i /><i /><i /><i /></div>
            <label className="field">
              <span>Repeat passphrase</span>
              <input className="input" type="password" autoComplete="new-password" value={confirm}
                onInput={(e) => setConfirm(val(e))} data-testid="input-passphrase-confirm" />
              <small>{pass.length}/12 characters minimum</small>
            </label>
          </>}
          {(error || storageError) && <div className="err" role="alert" data-testid="text-gate-error">{error || storageError}</div>}
          <button className="btn primary lg" disabled={busy || !pass} data-testid="button-gate-submit">
            {setup ? <KeyRound /> : <Lock />}
            {busy ? (setup ? 'Deriving key…' : 'Unlocking…') : setup ? 'Create encrypted vault' : 'Unlock'}
          </button>
          {setup
            ? <p className="note">Tip: four unrelated words make a strong, memorable passphrase.</p>
            : <button type="button" className="linkish" onClick={() => setWipe(true)} data-testid="button-forgot">Forgot it? Wipe this device and start over</button>}
        </form>
      </section>
      {wipe && <Confirm title="Wipe all data on this device" danger requireText="WIPE" confirmLabel="Wipe everything"
        body="This permanently deletes the encrypted vault, connected accounts, tokens, columns and audit log from this browser. It cannot be undone."
        onConfirm={() => void onWipe()} onClose={() => setWipe(false)} />}
    </main>
  );
}
