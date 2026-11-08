import { useState } from 'react';
import { errorMessage } from '../api';
import { useToast } from '../toast/ToastContext';
import { parseVillage } from '../village/parseVillage';

interface Props {
  /** receives the pasted export; returns the message to show as a toast (e.g. "Updated …") */
  onText: (text: string) => Promise<string | void>;
  label?: string;
}

export function PasteVillageButton({ onText, label = '📋 Paste village data' }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState('');

  const load = async (raw: string): Promise<string> => {
    const snap = parseVillage(raw); // validates; throws a friendly error
    if (!snap.tag) throw new Error('This export has no village tag, so it cannot be matched to a village.');
    return (await onText(raw)) ?? 'Village loaded ✔';
  };

  const click = async () => {
    setBusy(true);
    try {
      let raw: string | null = null;
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        try {
          raw = await navigator.clipboard.readText();
        } catch {
          raw = null;
        }
      }
      if (raw === null) {
        setManual(true);
        toast.warning('This browser blocked clipboard access. Paste your export in the box below instead.');
        return;
      }
      toast.success(await load(raw));
      setManual(false);
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const loadManual = async () => {
    setBusy(true);
    try {
      toast.success(await load(text));
      setText('');
      setManual(false);
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={manual ? 'w-full' : 'w-full sm:w-auto'}>
      <button className="btn-gold w-full sm:w-auto" onClick={() => void click()} disabled={busy}>
        {busy ? 'Reading…' : label}
      </button>

      {manual && (
        <div className="mt-3 space-y-2">
          <textarea
            className="field h-32 font-mono text-xs"
            placeholder="Paste the village export here"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn-green w-full sm:w-auto" onClick={() => void loadManual()} disabled={busy || !text.trim()}>
            Load village
          </button>
        </div>
      )}
    </div>
  );
}