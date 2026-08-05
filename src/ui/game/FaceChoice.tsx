import { useMemo } from 'react';
import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { BTN_GHOST_SMALL, BTN_SMALL, PANEL } from './styles';
import { faceOptionsFor, type FaceOption } from './faceOptions';

// "Which half?" — the panel a card with more than one playable face opens.
//
// ⚠️⚠️ **355 CARDS HAD A HALF NOBODY COULD PLAY** until D155: 98 modal DFCs, 123
// split cards and 134 adventures. `legalActions` had offered every castable face
// since M3 and the click path took `legal.find(…)` — the FIRST match — so a
// split card cast its left half, an adventure its creature, and a modal DFC its
// front face, whatever the player meant.
//
// ⚠️ **THE SHAPE IS D110's MANA PANEL, DELIBERATELY.** One option acts, more than
// one asks; the options are recomputed from `legal` every render rather than
// captured when the panel opened; the panel commits on the PICK, so choosing a
// half is one extra click and never two. A second idea of "how does this app ask
// you which thing you meant" is the thing worth not building.
//
// ⚠️ An UNAFFORDABLE half is shown, disabled, rather than hidden — you cannot
// choose it, and you can see that it is there. Hiding it is how `Malakir
// Rebirth` looks like a card with one half on a board with no black mana.

export function FaceChoicePanel() {
  const choice = useTable((s) => s.faceChoice);
  const close = useTable((s) => s.closeFaceChoice);
  const legal = useTable((s) => s.legal);
  const viewer = useTable((s) => s.viewer);
  const setMode = useTable((s) => s.setMode);
  const view = useGame((s) => s.view);

  /**
   * ⚠️ THE SAME TWO EFFECTS THE CLICK PATH HAS ALWAYS HAD, not a third way to
   * play a card: a land is a special action and goes straight out, a spell opens
   * the payment review. The only thing this panel adds is WHICH FACE.
   *
   * ⚠️ Targeting still aims with the front face's specs, which is named in D155
   * rather than fixed here — it fails SAFE, because the host validates against
   * the real face (D139) and rejects, rather than casting the wrong thing.
   */
  const play = (card: string, o: FaceOption): void => {
    close();
    if (o.kind === 'land') {
      session.submit({ t: 'PlayLand', player: viewer, card, faceIndex: o.faceIndex });
      return;
    }
    setMode({ kind: 'payment', card, faceIndex: o.faceIndex, xValue: 0, targets: [] });
  };

  const options = useMemo<FaceOption[]>(
    () => (choice ? faceOptionsFor(legal, choice.card) : []),
    [choice, legal],
  );

  // ⚠️ The panel closes itself the moment the choice stops existing — the card
  // was cast, discarded, or the turn moved on and the land half is no longer a
  // legal action. A stale panel offering a half that has gone is worse than none.
  if (!choice || options.length < 2) return null;

  const name = view.cards[choice.card]?.card?.name ?? 'This card';

  return (
    <div
      className={`fixed z-[1100] w-[212px] ${PANEL}`}
      style={{
        left: Math.min(choice.x, window.innerWidth - 222),
        top: Math.min(choice.y, window.innerHeight - 96 - options.length * 40),
      }}
      data-face-choice={options.length}
    >
      <div className="mb-2 text-[11px] uppercase tracking-wider text-crt-faint">Which half?</div>
      <div className="mb-2 truncate text-xs text-crt-dim" title={name}>
        {name}
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <button
            key={o.faceIndex}
            type="button"
            className={o.affordable || o.hasX ? BTN_SMALL : BTN_GHOST_SMALL}
            disabled={!o.affordable && !o.hasX}
            data-face-option={o.faceIndex}
            onClick={() => play(choice.card, o)}
          >
            <span className="truncate">{o.label}</span>
            <span className="ml-auto text-[10px] opacity-70">{o.kind === 'land' ? 'land' : 'spell'}</span>
          </button>
        ))}
      </div>
      <button type="button" className={`${BTN_GHOST_SMALL} mt-2 w-full justify-center`} onClick={close}>
        Cancel
      </button>
    </div>
  );
}
