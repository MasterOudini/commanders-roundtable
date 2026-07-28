import { useMemo } from 'react';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import * as session from '../../game/session';
import { ManaCost } from '../card/ManaCost';
import { handOffDropOrigin } from './useEngineTable';
import { BTN, BTN_GHOST, BTN_GHOST_SMALL, PANEL } from './styles';

// "Here is what I am about to tap. Cast, or let me do it myself."
//
// ⚠️ The preview runs the SAME solver the host validates against, from the same
// state — `session.previewCast` is a thin wrapper over `suggestPayment`. A
// separate preview implementation would drift, and the player would approve one
// payment and be charged another, which is the one thing an auto-tapper must
// never do.

export function PaymentReview() {
  const mode = useTable((s) => s.mode);
  const setMode = useTable((s) => s.setMode);
  const viewer = useTable((s) => s.viewer);
  const askNumber = useTable((s) => s.askNumber);
  const view = useGame((s) => s.view);

  const preview = useMemo(
    () => (mode.kind === 'payment' ? session.previewCast(mode.card, mode.xValue, mode.targets) : null),
    [mode],
  );

  if (mode.kind !== 'payment' || !preview) return null;

  const send = (): void => {
    // ⚠️ Close the panel optimistically. The host answers a round trip later on
    // a guest, so waiting for it would leave the review sitting there while the
    // spell was already on the stack; a rejection surfaces in the prompt bar.
    useTable.getState().setMessage(null);
    // If this review was opened by dropping the card on the battlefield, the card
    // is lying there right now — so that, not its empty hand slot, is where the
    // cast flight starts. A no-op for a review opened by clicking.
    handOffDropOrigin(mode.card);
    session.submit({
      t: 'CastSpell',
      player: viewer,
      card: mode.card,
      ...(preview.hasX ? { xValue: mode.xValue } : {}),
      ...(preview.plan ? { plan: preview.plan } : {}),
      // ⚠️ ALWAYS sent, even when empty, and the difference is load-bearing: an
      // OMITTED `targets` tells the engine "stop and ask me", while an empty
      // array says "none, deliberately". The UI has already asked by this point.
      targets: mode.targets,
    });
    setMode({ kind: 'idle' });
  };

  return (
    <div
      className={`absolute bottom-24 left-1/2 z-[980] w-[300px] -translate-x-1/2 ${PANEL}`}
      data-payment-review=""
    >
      <div className="flex items-baseline justify-between">
        <h2 className="truncate font-sc text-sm tracking-wider text-crt-text">{preview.name}</h2>
        <ManaCost cost={preview.cost} size={13} />
      </div>

      {preview.tax > 0 && (
        <p className="mt-1 text-[11px] text-crt-warn" data-payment-tax="">
          Commander tax {`{${preview.tax}}`} — cast #{preview.tax / 2 + 1} from the command zone.
        </p>
      )}

      {preview.hasX && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-crt-dim">X = {mode.xValue}</span>
          <button
            type="button"
            className={BTN_GHOST_SMALL}
            data-payment="set-x"
            onClick={() =>
              askNumber({
                title: `Choose X for ${preview.name}`,
                label: 'X',
                initial: mode.xValue,
                min: 0,
                max: 99,
                onSubmit: (xValue) => setMode({ kind: 'payment', card: mode.card, xValue, targets: mode.targets }),
              })
            }
          >
            Change…
          </button>
        </div>
      )}

      <p className="mt-2 text-[11px] uppercase tracking-wider text-crt-faint">Auto-tap will use</p>
      {preview.plan === null ? (
        <p className="mt-1 text-xs text-crt-warn" data-payment-unpayable="">
          Not enough mana available.
        </p>
      ) : (
        <ul className="mt-1 max-h-[120px] overflow-y-auto text-xs text-crt-dim" data-payment-taps="">
          {preview.taps.length === 0 && <li>Mana already in your pool.</li>}
          {preview.taps.map((id, i) => (
            <li key={`${id}-${i}`} className="truncate">
              {view.cards[id]?.card?.name ?? id}
            </li>
          ))}
          {preview.lifePaid > 0 && <li className="text-crt-warn">{preview.lifePaid} life (phyrexian)</li>}
        </ul>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className={BTN_GHOST}
          data-payment="cancel"
          onClick={() => setMode({ kind: 'idle' })}
        >
          Cancel
        </button>
        <button
          type="button"
          className={BTN}
          disabled={preview.plan === null}
          data-payment="cast"
          onClick={send}
        >
          Cast {preview.name}
        </button>
      </div>
    </div>
  );
}
