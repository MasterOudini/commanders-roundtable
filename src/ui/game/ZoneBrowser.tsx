import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { Card } from '../card/Card';
import { BTN_GHOST_SMALL, BTN_SMALL, PANEL } from './styles';
import { zoneCards, zoneId, type ZoneKind } from '../../view/types';

// Look through a graveyard or an exile pile, and move anything out of it.
//
// ⚠️ THE PILE ONLY EVER RENDERED ITS TOP CARD. A graveyard is a public zone with
// thirty cards in it and one of them on screen, so every card underneath was
// unreachable: you could not return the fifth card to your hand, reanimate the
// tenth, or read what was in there at all. The count badge said how many; nothing
// said which.
//
// ⚠️ All Tier 3, and all of it goes out as the `ManualMoveCard` the card menu
// already uses — the same intent, the same wrench in the log. What is new is
// being able to NAME a card that is not on top.
//
// ⚠️ ANY player's, not only mine. A graveyard is public information and reaching
// into an opponent's is a real play (their creature to my battlefield, their
// commander to the command zone). A card always goes to its OWNER's zone, which
// is what the card menu has always done.

/** Where a card in an open pile can go, and what to call it. */
const DESTINATIONS: readonly {
  readonly kind: 'hand' | 'battlefield' | 'library' | 'exile' | 'graveyard' | 'command';
  readonly label: string;
  readonly placement?: 'top' | 'bottom';
}[] = [
  { kind: 'hand', label: 'Hand' },
  { kind: 'battlefield', label: 'Battlefield' },
  { kind: 'library', label: 'Top', placement: 'top' },
  { kind: 'library', label: 'Bottom', placement: 'bottom' },
  { kind: 'graveyard', label: 'Graveyard' },
  { kind: 'exile', label: 'Exile' },
  { kind: 'command', label: 'Command' },
];

const KIND_WORD: Record<'gy' | 'exile', string> = { gy: 'graveyard', exile: 'exile' };

export function ZoneBrowser() {
  const browser = useTable((s) => s.zoneBrowser);
  const close = useTable((s) => s.closeZoneBrowser);
  const viewer = useTable((s) => s.viewer);
  const seats = useTable((s) => s.seats);
  const view = useGame((s) => s.view);

  if (!browser) return null;

  const { player, kind } = browser;
  // ⚠️ Read from the VIEW every render, never captured when the panel opened. A
  // card someone else returns to their hand while this is up must leave the
  // list — the same rule `AttachmentsPanel` and the mana panel follow.
  const ids = zoneCards(view, zoneId(kind as ZoneKind, player));
  const mine = player === viewer;
  const name = seats.find((s) => s.id === player)?.name ?? 'that player';
  const word = KIND_WORD[kind];

  const send = (intent: Parameters<typeof session.submit>[0]): void => {
    useTable.getState().setMessage(null);
    session.submit(intent);
  };

  const moveAll = (to: 'library' | 'exile', shuffle: boolean): void => {
    send({ t: 'ManualMoveZone', player: viewer, target: player, from: kind === 'gy' ? 'graveyard' : 'exile', to, shuffle });
    close();
  };

  return (
    <div
      className={`fixed left-1/2 top-20 z-[1150] max-h-[70vh] w-[560px] -translate-x-1/2 overflow-y-auto ${PANEL}`}
      data-zone-browser={`${kind}:${player}`}
      data-zone-browser-count={ids.length}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sc text-xs tracking-wider text-crt-text">
          {mine ? `Your ${word}` : `${name}'s ${word}`} · {ids.length} card{ids.length === 1 ? '' : 's'}
        </p>
        <button type="button" className={BTN_GHOST_SMALL} onClick={close} data-zone-browser-close="">
          Close
        </button>
      </div>

      {ids.length === 0 && (
        <p className="mt-2 text-[11px] text-crt-faint">Nothing in it.</p>
      )}

      {/* ⚠️ Newest first. A graveyard's array is oldest-first, and the card a
          player is looking for is almost always the one that just died. */}
      <div className="mt-2 flex flex-wrap gap-2">
        {[...ids].reverse().map((id) => {
          const card = view.cards[id];
          const owner = card?.owner ?? player;
          return (
            <div key={id} className="flex w-[104px] flex-col items-center gap-1" data-zone-card={id}>
              <Card card={card?.card ?? null} height={128} instanceId={id} registerSlot={false} />
              <div className="flex w-full flex-wrap justify-center gap-0.5">
                {DESTINATIONS.filter((d) => !(d.kind === kindZone(kind) && d.placement === undefined)).map((d) => (
                  <button
                    key={`${d.kind}:${d.placement ?? ''}`}
                    type="button"
                    className="rounded border border-crt-border bg-crt-raised px-1 py-0.5 text-[9px] text-crt-dim hover:border-crt-accent hover:text-crt-text"
                    data-zone-to={`${d.kind}${d.placement ? `-${d.placement}` : ''}`}
                    onClick={() =>
                      send({
                        t: 'ManualMoveCard',
                        player: viewer,
                        card: id,
                        // ⚠️ To the card's OWNER's zone. A stolen creature dying
                        // goes to the graveyard of whoever owns it, and putting
                        // it in the thief's would quietly rewrite whose deck it
                        // came from.
                        to: { kind: d.kind, player: owner },
                        ...(d.placement ? { placement: d.placement } : {}),
                      })
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {ids.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-crt-border pt-2">
          <span className="mr-1 text-[10px] text-crt-faint">All {ids.length}:</span>
          <button
            type="button"
            className={BTN_SMALL}
            data-zone-bulk="shuffle-in"
            onClick={() => moveAll('library', true)}
          >
            Shuffle into library
          </button>
          {/* Exiling an exile pile is not a thing that means anything. */}
          {kind === 'gy' && (
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-zone-bulk="exile-all"
              onClick={() => moveAll('exile', false)}
            >
              Exile the lot
            </button>
          )}
        </div>
      )}

      <p className="mt-2 border-t border-crt-border pt-1.5 text-[10px] leading-snug text-crt-faint">
        None of this is enforced — every move is marked in the log with a wrench.
      </p>
    </div>
  );
}

/** The engine zone kind this browser is showing, so it never offers "move here". */
function kindZone(kind: 'gy' | 'exile'): 'graveyard' | 'exile' {
  return kind === 'gy' ? 'graveyard' : 'exile';
}
