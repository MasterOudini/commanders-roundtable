import { useEffect } from 'react';
import * as session from '../../game/session';
import { useGame } from '../../store/gameStore';
import { useTable } from '../../store/tableStore';
import { zoneCards, zoneId, type InstanceId, type PlayerView } from '../../view/types';

// Point at a permanent and press E: it taps, or untaps if it was already turned.
//
// ⚠️ TIER 3, and the same one the card menu's Tap/Untap button has always been.
// This is a second way to reach `ManualSetTapped`, not a second idea of what
// tapping means — the intent, the wrench in the log and the ownership rules are
// whatever that button already had. Before this, turning a permanent by hand
// cost a right-click and a menu, which is a lot of gesture for the thing a
// Commander player does most often.
//
// ⚠️ It works on ANY permanent on the battlefield, mine or an opponent's, for the
// same reason the menu does: half the cards in the format say "tap target
// creature", and a manual tool that could only touch my own board would send the
// player back to the menu for the other half. Every use is logged as manual.

/**
 * The card the pointer is over, or null.
 *
 * ⚠️ MODULE STATE, not a store and not React state. Hover here is read exactly
 * once per keypress and drives nothing that renders, so putting it in a store
 * would commit the whole table on every pointer crossing — and `Card` is the leaf
 * that exists 50 times, whose memo is worth a measured 50–58 ms per commit.
 */
let hovered: InstanceId | null = null;

/**
 * Every element a card can be hit on, nearest first.
 *
 * `data-instance-id` is on the card itself — including an attachment tucked under
 * its host, which carries its own id and must be tappable as itself rather than
 * as the creature it is on. `data-band-slot` is the slot wrapper, and it is the
 * fallback for the few pixels of a pile's offset plates, which are decoration
 * with no card of their own.
 */
const HOVERABLE = '[data-instance-id], [data-band-slot]';

/**
 * ⚠️ A DELEGATED `pointerover`, NOT `elementFromPoint`.
 *
 * `AimVeil` records why it refuses `elementFromPoint` for its own hit test, and
 * two of its three reasons apply here unchanged: it forces a hit test against
 * current layout (flushing style and layout if anything is dirty), and it is an
 * UNMEASURED escape hatch — `perf.ts` patches `getBoundingClientRect` alone, so
 * an `elementFromPoint` habit would do the same damage while keeping the meter at
 * zero. One bubbled event and a `closest()` call cost nothing, read no geometry,
 * and are already the browser's own hit test.
 *
 * ⚠️ Leaving a card needs no handler of its own: `pointerover` fires on whatever
 * is entered NEXT, including the table behind the card, and `closest` returning
 * null is what clears the hover.
 */
function onPointerOver(e: PointerEvent): void {
  hoverFrom(e.target instanceof Element ? e.target : null);
}

/**
 * The ONE writer of `hovered` — resolve whatever the pointer entered to the card
 * it belongs to, or to nothing.
 *
 * ⚠️ Separate from the listener so a probe can drive the production path without
 * synthesizing a `PointerEvent`, exactly as `aim.moveTo` is the one writer the
 * real `pointermove` handler calls. A synthetic pointer event that races the real
 * mouse is the failure mode this workspace already paid for once.
 */
export function hoverFrom(target: Element | null): InstanceId | null {
  const el = target?.closest(HOVERABLE) ?? null;
  hovered = el
    ? (el.getAttribute('data-instance-id') ?? el.getAttribute('data-band-slot'))
    : null;
  return hovered;
}

function onWindowBlur(): void {
  // The pointer can leave the window without entering anything else, and a stale
  // hover would let the next E act on a card nobody is pointing at.
  hovered = null;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'e' && e.key !== 'E') return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  // ⚠️ `e` is a CHARACTER. It is legal inside every text field in the app and
  // inside a number input as well (`1e5`), so a window-level letter shortcut that
  // did not check the focused element would eat it out of the deck-import box and
  // the Tier-3 number dialogs.
  const el = e.target as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
  actOnCardUnderCursor();
}

/**
 * Is this card on a battlefield — anyone's? Tapping means nothing anywhere else.
 *
 * ⚠️ This guards the LOG, not the state. `reducer.ts` already ignores a tap on a
 * card outside the battlefield (CR 110.5b — the Tier-3 tool is permissive about
 * what you point it at, and the fuzzer duly pointed it at a hand), so without
 * this the card would still not turn. What it would do is append
 * "You tap Island." as a manual line about a thing that did not happen — and a
 * log that a pod uses to tell the automated from the hand-waved cannot afford
 * entries for actions the engine discarded.
 */
function onBattlefield(view: PlayerView, id: InstanceId): boolean {
  const card = view.cards[id];
  // Projection files a permanent under its CONTROLLER, so that is the one zone
  // that can hold it — see `project.ts`.
  return !!card && zoneCards(view, zoneId('bf', card.controller)).includes(id);
}

/**
 * Do to the permanent under the cursor whatever CLICKING it would do.
 *
 * ⚠️ E IS THE CLICK, not a second idea of what a card does. It used to send
 * `ManualSetTapped` — it turned the card and nothing else — so pressing it on a
 * land turned the land without making any mana, which is not what a player
 * means by "tap this land". Now it routes to the same `onCardClick` a left click
 * does: a land taps for its mana or opens the chooser, an Equipment starts its
 * aim, a creature is offered `Tap`. "Turn it and nothing else" did not go away;
 * it is the `Tap only` button in that panel, and the card menu's button.
 *
 * ⚠️ The handler is passed IN rather than imported, because it is a
 * `useCallback` over live state — legality, the current mode, the view. A copy
 * captured in this module would be answering with the board as it was when the
 * table mounted, which is the stale-binding trap `devHandles` warns about.
 */
let clickHandler: ((id: InstanceId) => void) | null = null;

/** Returns whether it acted, which is what makes the key assertable. */
export function actOnCardUnderCursor(): boolean {
  const id = hovered;
  if (id === null || !session.isRunning() || !clickHandler) return false;

  const table = useTable.getState();
  // ⚠️ IDLE ONLY. Mid-aim, mid-payment or mid-declaration the table is asking a
  // question, and a stray letter must not quietly answer a different one — the
  // taps a payment is proposing are exactly the ones this would fight over. The
  // veil covers the cards during targeting anyway, so `hovered` is null there;
  // this is the guard for the modes that have no veil.
  if (table.mode.kind !== 'idle') return false;
  if (table.numberRequest || table.textRequest) return false;

  // ⚠️ BATTLEFIELD ONLY, still. A click means something in every zone — it casts
  // out of a hand — and a letter key that cast a spell because the cursor
  // happened to be over the fan would be a misclick with a real cost. `E` is
  // about permanents, which is where "tap" means anything.
  const view = useGame.getState().view;
  if (!view.cards[id] || !onBattlefield(view, id)) return false;

  table.setMessage(null);
  clickHandler(id);
  return true;
}

/** What E would act on right now. Dev handles only. */
export function hoveredInstanceId(): InstanceId | null {
  return hovered;
}

export function useTapKey(onCardClick: (id: InstanceId) => void): void {
  // ⚠️ Kept in a ref-like module slot rather than closed over by the listener,
  // so a re-render with new legality does not need the listener re-registered —
  // and so the listener can never call yesterday's handler.
  clickHandler = onCardClick;
  useEffect(() => {
    window.addEventListener('pointerover', onPointerOver);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointerover', onPointerOver);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);
}
