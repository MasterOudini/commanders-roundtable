import { useMemo } from 'react';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import * as session from '../../game/session';
import { BTN_GHOST_SMALL, BTN_SMALL, LABEL, PANEL } from './styles';
import { beginAimFrom } from './aimCommit';
import { zoneCards, zoneId, type ZoneKind } from '../../view/types';
import type { CardData } from '../../data/cardTypes';

// Tier 3 — the manual tools drawer, and the per-card menu.
//
// ⚠️ These are the whole reason the app can be honest about scope. The engine
// does not know what any individual card does, so rather than guessing it gives
// the player clean tools and marks every use in the log. In a friends game that
// is a trust feature: the log always distinguishes what was automated from what
// was hand-waved.
//
// ⚠️ NO `window.prompt`. Every number goes through `askNumber`, which opens a
// real dialog — `window.prompt` throws in Electron and a probe greps for it.

const ZONES: readonly { readonly kind: ZoneKind; readonly label: string }[] = [
  { kind: 'hand', label: 'Hand' },
  { kind: 'bf', label: 'Battlefield' },
  { kind: 'gy', label: 'Graveyard' },
  { kind: 'exile', label: 'Exile' },
  { kind: 'lib', label: 'Library' },
  { kind: 'cmd', label: 'Command' },
];

const ENGINE_ZONE: Record<ZoneKind, 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'library' | 'command'> = {
  hand: 'hand',
  bf: 'battlefield',
  gy: 'graveyard',
  exile: 'exile',
  lib: 'library',
  cmd: 'command',
};

export function ManualToolsDrawer({ tokens }: { tokens: readonly CardData[] }) {
  const open = useTable((s) => s.toolsOpen);
  const setOpen = useTable((s) => s.setToolsOpen);
  const viewer = useTable((s) => s.viewer);
  const seats = useTable((s) => s.seats);
  const askNumber = useTable((s) => s.askNumber);
  if (!open) return null;

  const send = (intent: Parameters<typeof session.submit>[0]): void => {
    useTable.getState().setMessage(null);
    session.submit(intent);
  };

  return (
    <div className={`absolute left-2 top-10 z-[970] w-[280px] ${PANEL}`} data-tools-drawer="">
      <div className="flex items-center justify-between">
        <h2 className="font-sc text-xs tracking-wider text-crt-text">Manual tools</h2>
        <button type="button" className={BTN_GHOST_SMALL} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-crt-faint">
        Nothing here is enforced. Every use is marked in the log with a wrench.
      </p>

      <p className={`mt-3 ${LABEL}`}>Life</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {seats.map((seat) => (
          <div key={seat.id} className="flex items-center gap-0.5">
            <span className="text-[11px] text-crt-dim">{seat.name}</span>
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-tool={`life-down-${seat.id}`}
              onClick={() => send({ t: 'ManualSetLife', player: viewer, target: seat.id, delta: -1 })}
            >
              −1
            </button>
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-tool={`life-up-${seat.id}`}
              onClick={() => send({ t: 'ManualSetLife', player: viewer, target: seat.id, delta: +1 })}
            >
              +1
            </button>
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-tool={`life-set-${seat.id}`}
              onClick={() =>
                askNumber({
                  title: `Adjust ${seat.name}'s life`,
                  label: 'Change by',
                  initial: -5,
                  min: -999,
                  max: 999,
                  onSubmit: (delta) =>
                    send({ t: 'ManualSetLife', player: viewer, target: seat.id, delta }),
                })
              }
            >
              …
            </button>
          </div>
        ))}
      </div>

      <p className={`mt-3 ${LABEL}`}>Mana</p>
      <div className="mt-1 flex gap-1">
        {(['W', 'U', 'B', 'R', 'G', 'C'] as const).map((symbol) => (
          <button
            key={symbol}
            type="button"
            className={BTN_GHOST_SMALL}
            data-tool={`mana-${symbol}`}
            onClick={() =>
              send({ t: 'ManualAddMana', player: viewer, target: viewer, symbol, amount: 1 })
            }
          >
            {symbol}
          </button>
        ))}
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-tool="mana-empty"
          onClick={() => send({ t: 'ManualEmptyPool', player: viewer, target: viewer })}
        >
          Empty
        </button>
      </div>

      <p className={`mt-3 ${LABEL}`}>Tokens</p>
      <div className="mt-1 flex max-h-[92px] flex-wrap gap-1 overflow-y-auto">
        {tokens.length === 0 && <span className="text-[11px] text-crt-faint">No token data loaded.</span>}
        {tokens.map((token) => (
          <button
            key={token.scryfallId}
            type="button"
            className={BTN_GHOST_SMALL}
            data-tool={`token-${token.name}`}
            onClick={() =>
              send({ t: 'ManualCreateToken', player: viewer, printingId: token.scryfallId, count: 1 })
            }
          >
            {token.name}
          </button>
        ))}
      </div>

      <p className={`mt-3 ${LABEL}`}>Library</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-tool="draw"
          onClick={() => send({ t: 'ManualDraw', player: viewer, target: viewer, count: 1 })}
        >
          Draw 1
        </button>
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-tool="peek"
          onClick={() =>
            askNumber({
              title: 'Look at the top of your library',
              label: 'How many cards',
              initial: 1,
              min: 1,
              max: 20,
              onSubmit: (count) => send({ t: 'ManualPeekLibrary', player: viewer, count }),
            })
          }
        >
          Look at top…
        </button>
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-tool="shuffle"
          onClick={() => send({ t: 'ManualShuffle', player: viewer, target: viewer })}
        >
          Shuffle
        </button>
      </div>

      <p className={`mt-3 ${LABEL}`}>Randomness</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {[6, 20].map((sides) => (
          <button
            key={sides}
            type="button"
            className={BTN_GHOST_SMALL}
            data-tool={`d${sides}`}
            onClick={() => send({ t: 'RollDice', player: viewer, sides })}
          >
            d{sides}
          </button>
        ))}
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-tool="coin"
          onClick={() => send({ t: 'FlipCoin', player: viewer })}
        >
          Flip a coin
        </button>
      </div>
    </div>
  );
}

/** The per-card context menu: everything you can do to one specific card. */
export function CardMenu() {
  const menu = useTable((s) => s.cardMenu);
  const close = useTable((s) => s.closeCardMenu);
  const viewer = useTable((s) => s.viewer);
  const askNumber = useTable((s) => s.askNumber);
  const view = useGame((s) => s.view);

  const card = menu ? view.cards[menu.card] : undefined;
  const zone = useMemo(() => {
    if (!menu) return null;
    for (const [id, ids] of Object.entries(view.zones)) {
      if ((ids ?? []).includes(menu.card)) return id;
    }
    return null;
  }, [menu, view.zones]);

  if (!menu || !card) return null;

  const send = (intent: Parameters<typeof session.submit>[0]): void => {
    useTable.getState().setMessage(null);
    session.submit(intent);
    close();
  };

  const owner = card.owner;
  const onBattlefield = zone?.startsWith('bf:') ?? false;
  // ⚠️ The engine puts loyalty and defense counters on at entry (CR 306.5b/310.6)
  // and SBA 4 bins the permanent when they reach 0 — but `+1`/`−2`/`−5` is Tier 3,
  // because a loyalty ability has no colon and the ingest never reads one. So
  // this button is the ONLY way to spend loyalty, and without it the engine
  // would count something down that nobody could touch. Keyed off the counter
  // actually being there, so it never shows up on a creature.
  const spendable: 'loyalty' | 'defense' | null =
    card.counters['loyalty'] !== undefined
      ? 'loyalty'
      : card.counters['defense'] !== undefined
        ? 'defense'
        : null;

  return (
    <div
      className={`absolute z-[1100] w-[190px] ${PANEL}`}
      style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 300) }}
      data-card-menu={menu.card}
    >
      <p className="truncate font-sc text-[11px] tracking-wider text-crt-text">
        {card.card?.name ?? 'Hidden card'}
      </p>

      {onBattlefield && (
        <div className="mt-1 flex flex-wrap gap-1">
          <button
            type="button"
            className={BTN_GHOST_SMALL}
            data-menu="tap"
            onClick={() =>
              send({ t: 'ManualSetTapped', player: viewer, cards: [menu.card], tapped: !card.tapped })
            }
          >
            {card.tapped ? 'Untap' : 'Tap'}
          </button>
          <button
            type="button"
            className={BTN_GHOST_SMALL}
            data-menu="counter"
            onClick={() =>
              askNumber({
                title: 'Add +1/+1 counters',
                label: 'How many (negative removes)',
                initial: 1,
                min: -99,
                max: 99,
                onSubmit: (delta) =>
                  send({ t: 'ManualSetCounter', player: viewer, card: menu.card, kind: '+1/+1', delta }),
              })
            }
          >
            +1/+1…
          </button>
          {spendable && (
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-menu={spendable}
              onClick={() =>
                askNumber({
                  title: spendable === 'loyalty' ? 'Loyalty counters' : 'Defense counters',
                  label: 'How many (negative removes)',
                  initial: spendable === 'loyalty' ? 1 : -1,
                  min: -99,
                  max: 99,
                  onSubmit: (delta) =>
                    send({ t: 'ManualSetCounter', player: viewer, card: menu.card, kind: spendable, delta }),
                })
              }
            >
              {spendable === 'loyalty' ? 'Loyalty' : 'Defense'} {card.counters[spendable] ?? 0}…
            </button>
          )}
          <button
            type="button"
            className={BTN_GHOST_SMALL}
            data-menu="facedown"
            onClick={() =>
              send({ t: 'ManualSetFaceDown', player: viewer, card: menu.card, faceDown: !card.faceDown })
            }
          >
            {card.faceDown ? 'Turn up' : 'Turn down'}
          </button>
          <button
            type="button"
            className={BTN_GHOST_SMALL}
            data-menu="flip"
            onClick={() => send({ t: 'ManualFlipFace', player: viewer, card: menu.card })}
          >
            Transform
          </button>
        </div>
      )}

      <p className={`mt-2 ${LABEL}`}>Move to</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {ZONES.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            className={BTN_SMALL}
            data-menu={`move-${kind}`}
            onClick={() =>
              send({
                t: 'ManualMoveCard',
                player: viewer,
                card: menu.card,
                to: { kind: ENGINE_ZONE[kind], player: owner },
              })
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-between">
        <button
          type="button"
          className={BTN_GHOST_SMALL}
          data-menu="commander"
          onClick={() =>
            send({
              t: 'ManualSetCommander',
              player: viewer,
              card: menu.card,
              isCommander: !card.isCommander,
            })
          }
        >
          {card.isCommander ? 'Not a commander' : 'Make commander'}
        </button>
        <button type="button" className={BTN_GHOST_SMALL} onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}

/** How many cards a zone holds, for the tools drawer's summary line. */
export function zoneCount(view: ReturnType<typeof useGame.getState>['view'], kind: ZoneKind, player: string): number {
  return view.hiddenCounts[zoneId(kind, player)] ?? zoneCards(view, zoneId(kind, player)).length;
}

/**
 * What is on this permanent: every Aura, Equipment and Fortification attached to
 * it, and what can be done with each.
 *
 * ⚠️ This exists because the tuck is a good picture and a bad affordance. An
 * attachment renders behind its host offset by 13 px — you can see that
 * SOMETHING is there, you cannot read what, and there is nothing to click. The
 * tab on the host's left edge opens this.
 *
 * ⚠️ Everything here is Tier 3 and says so: `Move` re-points the attachment with
 * the same aim `useEngineTable` opens, `Take off` is a `ManualAttach` to nothing.
 * Neither charges an equip cost, because `Equip {2}` is not an ability the
 * engine can charge (D96).
 */
export function AttachmentsPanel() {
  const panel = useTable((s) => s.attachments);
  const close = useTable((s) => s.closeAttachments);
  const viewer = useTable((s) => s.viewer);
  const setMode = useTable((s) => s.setMode);
  const openCardMenu = useTable((s) => s.openCardMenu);
  const view = useGame((s) => s.view);

  const host = panel ? view.cards[panel.host] : undefined;
  // ⚠️ Read from the VIEW every render, not captured when the panel opened. An
  // attachment that moved or died while this was open must leave the list.
  const attached = useMemo(
    () =>
      !panel
        ? []
        : zoneCards(view, zoneId('bf', host?.controller ?? viewer))
          .filter((id) => view.cards[id]?.attachedTo === panel.host),
    [panel, view, host?.controller, viewer],
  );

  if (!panel || !host) return null;

  const send = (intent: Parameters<typeof session.submit>[0]): void => {
    useTable.getState().setMessage(null);
    session.submit(intent);
  };

  const hostName = host.card?.name ?? 'this permanent';

  return (
    <div
      className={`absolute z-[1100] w-[236px] ${PANEL}`}
      style={{
        left: Math.min(panel.x, window.innerWidth - 246),
        top: Math.min(panel.y, window.innerHeight - 40 - attached.length * 58),
      }}
      data-attachments-panel={panel.host}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-sc text-[11px] tracking-wider text-crt-text">
          On {hostName}
        </p>
        <button
          type="button"
          className="text-[11px] text-crt-faint hover:text-crt-text"
          onClick={close}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {attached.length === 0 && (
        <p className="mt-2 text-[11px] text-crt-faint">Nothing is attached to it now.</p>
      )}

      {attached.map((id) => {
        const att = view.cards[id];
        const name = att?.card?.name ?? 'Hidden card';
        const type = att?.card?.faces[att.faceIndex]?.typeLine ?? '';
        return (
          <div key={id} className="mt-2 border-t border-crt-border pt-2" data-attachment-row={id}>
            <p className="truncate text-[12px] text-crt-text">{name}</p>
            <p className="truncate text-[10px] text-crt-faint">{type}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                type="button"
                className={BTN_GHOST_SMALL}
                data-attachment-action="move"
                onClick={() => {
                  close();
                  setMode({
                    kind: 'attach',
                    card: id,
                    name,
                    creaturesOnly: /\bEquipment\b/.test(type),
                  });
                  beginAimFrom(id);
                }}
              >
                Move
              </button>
              <button
                type="button"
                className={BTN_GHOST_SMALL}
                data-attachment-action="detach"
                onClick={() => {
                  send({ t: 'ManualAttach', player: viewer, card: id, to: null });
                  close();
                }}
              >
                Take off
              </button>
              <button
                type="button"
                className={BTN_GHOST_SMALL}
                data-attachment-action="more"
                onClick={() => openCardMenu(id, panel.x, panel.y)}
              >
                More…
              </button>
            </div>
          </div>
        );
      })}

      <p className="mt-2 border-t border-crt-border pt-1.5 text-[10px] leading-snug text-crt-faint">
        Moving or taking one off costs nothing here — the equip cost and its
        timing are yours.
      </p>
    </div>
  );
}
