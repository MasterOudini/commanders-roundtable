import { useEffect, useState } from 'react';
import { FolderOpen, Wifi, WifiOff } from 'lucide-react';
import { useSettings } from '../../store/settingsStore';
import type { AppInfo, UpdaterStatus } from '../../types/bridge';

// Placeholder home screen. It is a real diagnostic surface — it proves the
// preload bridge, the settings round trip and the updater channel work — and the
// deck list / lobby replace it in later steps.

export function HomeScreen() {
  const { settings, hydrated, ephemeral } = useSettings();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null);

  useEffect(() => {
    const bridge = window.crt;
    if (!bridge) return;
    void bridge.app.info().then(setInfo);
    void bridge.updater.status().then(setUpdater);
    return bridge.updater.onStatus(setUpdater);
  }, []);

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <section className="rounded-lg border border-crt-border bg-crt-surface p-5">
          <h2 className="font-sc mb-3 text-sm tracking-wider text-crt-dim">Shell</h2>
          {ephemeral ? (
            <p className="flex items-center gap-2 text-sm text-crt-warn">
              <WifiOff size={16} aria-hidden />
              Running in a browser tab — the desktop bridge is not available, so
              settings will not be saved.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-crt-ok">
              <Wifi size={16} aria-hidden />
              Desktop bridge connected.
            </p>
          )}

          {info && (
            <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-crt-faint">Mode</dt>
              <dd>{info.isPackaged ? 'Installed build' : 'Development'}</dd>
              <dt className="text-crt-faint">Electron</dt>
              <dd className="crt-num">{info.versions.electron}</dd>
              <dt className="text-crt-faint">Chromium</dt>
              <dd className="crt-num">{info.versions.chrome}</dd>
              <dt className="text-crt-faint">Your files</dt>
              <dd className="crt-num break-all text-xs">{info.dataRoot}</dd>
            </dl>
          )}

          {info && (
            <button
              type="button"
              onClick={() => void window.crt?.app.showDataFolder()}
              className="mt-4 inline-flex items-center gap-2 rounded border border-crt-border-hi bg-crt-raised px-3 py-1.5 text-sm transition-colors hover:border-crt-accent hover:text-crt-accent-hi"
            >
              <FolderOpen size={15} aria-hidden />
              Open my files folder
            </button>
          )}
        </section>

        {/* ⚠️ The settings controls that used to live here moved to the Settings
            screen in M5. Two surfaces writing the same schema is how they drift:
            this one carried a subset, so a user who changed the picture quality
            on one screen and came back here saw no sign of it. */}
        <section className="rounded-lg border border-crt-border bg-crt-surface p-5">
          <h2 className="font-sc mb-3 text-sm tracking-wider text-crt-dim">You</h2>
          {!hydrated ? (
            <p className="text-sm text-crt-faint">Loading…</p>
          ) : (
            <p className="text-sm text-crt-dim">
              You are{' '}
              <span className="text-crt-text">{settings.playerName || 'unnamed'}</span> at the table.
              Change that, the animation speed and everything else on the{' '}
              <button
                type="button"
                onClick={() => { window.location.hash = 'settings'; }}
                className="underline decoration-dotted underline-offset-2 hover:text-crt-accent-hi"
              >
                Settings
              </button>{' '}
              screen.
            </p>
          )}
        </section>

        {updater && (
          <section className="rounded-lg border border-crt-border bg-crt-surface p-5">
            <h2 className="font-sc mb-2 text-sm tracking-wider text-crt-dim">Updates</h2>
            <p className="text-sm text-crt-dim">{updater.message ?? `Status: ${updater.state}`}</p>
          </section>
        )}
      </div>
    </div>
  );
}
