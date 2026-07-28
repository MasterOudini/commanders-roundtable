import { useEffect, useRef, useState } from 'react';
import { useTable } from '../../store/tableStore';
import { BTN, BTN_GHOST, FIELD, PANEL } from './styles';

// ⚠️ `window.prompt()`, `confirm()` and `alert()` THROW in Electron. Every
// number and text input in this app comes through here, and a probe greps
// `src/` for those three names and must find nothing. This is the whole reason
// the component exists — it is not a styling preference.

export function NumberDialog() {
  const request = useTable((s) => s.numberRequest);
  const close = useTable((s) => s.closeDialogs);
  const [value, setValue] = useState('0');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setValue(String(request.initial));
    // A dialog that opens without focus makes the player click twice.
    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [request]);

  if (!request) return null;
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= request.min && parsed <= request.max;

  const submit = (): void => {
    if (!valid) return;
    request.onSubmit(Math.round(parsed));
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-crt-void/70"
      data-dialog="number"
    >
      <div className={`w-[280px] ${PANEL}`}>
        <h2 className="font-sc text-sm tracking-wider text-crt-text">{request.title}</h2>
        <label className="mt-3 block text-xs text-crt-dim">
          {request.label}
          <input
            ref={inputRef}
            type="number"
            className={`crt-num mt-1 ${FIELD}`}
            value={value}
            min={request.min}
            max={request.max}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') close();
            }}
          />
        </label>
        {!valid && (
          <p className="mt-1 text-[11px] text-crt-warn">
            Enter a whole number between {request.min} and {request.max}.
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className={BTN_GHOST} onClick={close}>
            Cancel
          </button>
          <button type="button" className={BTN} disabled={!valid} onClick={submit} data-dialog-ok="">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function TextDialog() {
  const request = useTable((s) => s.textRequest);
  const close = useTable((s) => s.closeDialogs);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setValue(request.initial);
    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [request]);

  if (!request) return null;

  const submit = (): void => {
    if (value.trim() === '') return;
    request.onSubmit(value.trim());
    close();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-crt-void/70" data-dialog="text">
      <div className={`w-[320px] ${PANEL}`}>
        <h2 className="font-sc text-sm tracking-wider text-crt-text">{request.title}</h2>
        <label className="mt-3 block text-xs text-crt-dim">
          {request.label}
          <input
            ref={inputRef}
            type="text"
            className={`mt-1 ${FIELD}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') close();
            }}
          />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className={BTN_GHOST} onClick={close}>
            Cancel
          </button>
          <button type="button" className={BTN} onClick={submit} data-dialog-ok="">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
