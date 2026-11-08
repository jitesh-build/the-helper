import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <h1 className="stroke mb-1 text-center text-4xl text-coc-gold">⚒ Hammer Jam Planner</h1>
      <p className="stroke mb-6 text-center">Log in to save your boosts, potions and village.</p>

      <form className="panel space-y-3" onSubmit={(e) => void submit(e)}>
        <h2 className="panel-title mb-3">{mode === 'login' ? 'Welcome back, Chief' : 'Create your account'}</h2>

        {mode === 'register' && (
          <label className="block">
            <span className="label">Name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" required />
          </label>
        )}
        <label className="block">
          <span className="label">Email</span>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="label">Password {mode === 'register' && '(min 8 characters)'}</span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : undefined}
            required
          />
        </label>

        {error && <p className="text-coc-danger">{error}</p>}

        <button className="btn-gold w-full text-lg" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Register'}
        </button>
        <button
          type="button"
          className="w-full text-sm underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? "No account? Register" : 'Already have an account? Log in'}
        </button>
      </form>
    </main>
  );
}