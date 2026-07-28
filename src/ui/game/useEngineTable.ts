import { useCallback, useEffect } from 'react';
import * as session from '../../game/session';
import { useGame } from '../../store/gameStore';
import { useTable, type TableMode, type TargetSource } from '../../store/tableStore';
import { useAim } from '../../store/aimStore';
import { beginAimFrom, onVeilPick } from './aimCommit';
import { useDrag, type DropCheck } from '../../store/dragStore';
import { cardSlot, resolveKey, setDropOrigin, takeDropOrigin, type FrozenRect } from '../anim/rectRegistry';
import { zoneCards, zoneId } from '../../view/types';
import type { InstanceId, PlayerView } from '../../view/types';

/**
 * How long a dropped card waits, parked where it was let go, before it flies back
 * to the fan. Long enough to cover a host round trip; short enough that a refused
 * intent does not leave a card lying on the table.
 */
const PARK_MS = 900;

/** The card a mid-cast mode is about, whichever stage it is at. */
function castCardOf(mode: TableMode): string | null {
  if (mode.kind === 'payment') return mode.card;
  if (mode.kind === 'targeting') return mode.source.card;
  return null;
}

/** Movement before a press on a permanent becomes an attach drag. */
const ATTACH_DRAG_PX = 6;

/**
 * Can this permanent be attached to something, and to what?
 *
 * ⚠️ The TYPE LINE, not an ability. `Equip {2}` is not something the engine
 * parses or charges (`activatedParse.ts`), so what makes a card attachable here
 * is that it is an Equipment, an Aura or a Fortification — which is also exactly
 * what `BattlefieldBand` already draws on its host.
 */
function attachableAs(view: PlayerView, id: InstanceId, viewer: string):
  { name: string; creaturesOnly: boolean } | null {
  const inst = view.cards[id];
  if (!inst?.card || inst.controller !== viewer) return null;
  if (!zoneCards(view, zoneId('bf', viewer)).includes(id)) return null;
  const face = inst.card.faces[inst.faceIndex] ?? inst.card.faces[0];
  const type = face?.typeLine ?? '';
  const name = face?.name ?? inst.card.name;
  if (/\bEquipment\b/.test(type)) return { name, creaturesOnly: true };
  if (/\bAura\b/.test(type) || /\bFortification\b/.test(type)) return { name, creaturesOnly: false };
  return null;
}

// What a click on a card MEANS depends on what the game is waiting for. This
// hook is the single place that decides, so the table components stay dumb.
//
// The same is true of a DROP. `src/ui/table/` reports "this card was let go over
// your side of the table, at this rect"; everything about what that does — is it
// a land, is it affordable, does it need the payment review — is decided here.
//
// ⚠️ It reads legality from `session`'s `legalActions`, never from its own
// guesses. If a click would be rejected, the affordance is not offered — and if
// one slips through anyway, the host's rejection is shown in the prompt bar
// rather than silently swallowed. Clicks stay live mid-animation on purpose:
// acting on a view that is one group stale is safe because legality is checked
// engine-side.

export function useEngineTable() {
  const mode = useTable((s) => s.mode);
  const setMode = useTable((s) => s.setMode);
  const legal = useTable((s) => s.legal);
  const viewer = useTable((s) => s.viewer);
  const seats = useTable((s) => s.seats);
  const awaiting = useTable((s) => s.awaiting);
  const openCardMenu = useTable((s) => s.openCardMenu);
  const view = useGame((s) => s.view);

  // Mirror the session into the store so components re-render on engine change.
  //
  // ⚠️ The message is pushed rather than returned. A rejection arrives from the
  // host — synchronously over a loopback, a round trip later over a socket — so
  // it cannot be the return value of `submit()` without lying on one side of the
  // wire. Only a CHANGE is written through, so a local hint ("you cannot pay for
  // that right now") is not stomped by the next unrelated snapshot.
  useEffect(() => {
    let lastMessage: string | null = null;
    const apply = (snapshot: session.SessionSnapshot): void => {
      useTable.getState().setSnapshot({
        awaiting: snapshot.awaiting,
        legal: [...snapshot.legal],
        viewer: snapshot.viewer,
        seats: [...snapshot.seats],
        running: snapshot.running,
        finished: snapshot.finished,
        winners: [...snapshot.winners],
      });
      if (snapshot.message !== lastMessage) {
        lastMessage = snapshot.message;
        useTable.getState().setMessage(snapshot.message);
      }
    };
    apply(session.current());
    return session.subscribe(apply);
  }, []);

  const send = useCallback((intent: Parameters<typeof session.submit>[0]) => {
    useTable.getState().setMessage(null);
    session.submit(intent);
  }, []);

  /**
   * Enter targeting for a spell or ability, if it wants any.
   *
   * Returns false when it does not, so the caller goes straight on to payment —
   * a veil with nothing to pick is a modal that says nothing.
   */
  const beginAim = useCallback(
    (source: TargetSource, name: string, next: 'payment' | 'submit'): boolean => {
      const specs =
        source.kind === 'ability'
          ? session.targetSpecsFor(source.card, source.abilityIndex)
          : session.targetSpecsFor(source.card);
      const max = specs.reduce((n, s) => n + s.max, 0);
      if (specs.length === 0 || max === 0) return false;
      const min = specs.reduce((n, s) => n + s.min, 0);
      setMode({ kind: 'targeting', source, name, chosen: [], specs, min, max, next });
      // The arrow's tail: the card itself, or wherever it was dropped.
      const rect = takeDropOrigin(source.card) ?? resolveKey(cardSlot(source.card));
      useAim.getState().begin({ sourceKey: cardSlot(source.card), sourceRect: rect, viaDrag: false });
      return true;
    },
    [setMode],
  );

  const onCardClick = useCallback(
    (id: InstanceId) => {
      if (!session.isRunning()) return;

      // Declaring attackers: click to arm or unarm, against the current default
      // defender. Drag onto a pod (or use the defender chips) to send one
      // somewhere else.
      if (mode.kind === 'attackers') {
        const already = mode.chosen.some((a) => a.card === id);
        const defender = mode.defaultDefender;
        const chosen = already
          ? mode.chosen.filter((a) => a.card !== id)
          : defender
            ? [...mode.chosen, { card: id, defender }]
            : mode.chosen;
        setMode({ ...mode, chosen });
        return;
      }

      // Declaring blocks: first click picks the blocker, second the attacker.
      //
      // ⚠️ Routed through the SAME `onVeilPick` the veil uses, so a click on the
      // card and a click on the veil's hit area cannot end up doing different
      // things — and so the arrow is started and cleared in one place.
      if (mode.kind === 'blockers') {
        onVeilPick({ kind: 'card', id });
        return;
      }

      // Mulligan bottoming: click a card in hand to send it to the bottom.
      if (awaiting?.kind === 'mulliganBottom' && awaiting.player === viewer) {
        const hand = zoneCards(view, zoneId('hand', viewer));
        if (!hand.includes(id)) return;
        send({ t: 'MulliganBottom', player: viewer, cards: [id] });
        return;
      }

      if (mode.kind !== 'idle') return;

      const land = legal.find((a) => a.t === 'PlayLand' && a.card === id);
      if (land) {
        send({ t: 'PlayLand', player: viewer, card: id });
        return;
      }

      const cast = legal.find((a) => a.t === 'CastSpell' && a.card === id);
      if (cast?.t === 'CastSpell') {
        if (!cast.affordable && !cast.hasX) {
          useTable.getState().setMessage(`You cannot pay for ${cast.label} right now.`);
          return;
        }
        // ⚠️ TARGETS COME FIRST — CR 601.2c precedes 601.2f, and it is not a
        // formality here: the ward surcharge is priced from what you are
        // pointing at, so opening payment before the targets are known showed a
        // cost that could still change. It is also what makes Escape purely
        // local: nothing has been sent, so there is no half-cast to unwind.
        if (beginAim({ kind: 'spell', card: id }, cast.label, 'payment')) return;
        setMode({ kind: 'payment', card: id, xValue: 0, targets: [] });
        return;
      }

      // A permanent that can make mana: tap it. The first output is the
      // default; the card menu offers the rest.
      const tap = legal.find((a) => a.t === 'TapForMana' && a.card === id && !a.conditional);
      if (tap?.t === 'TapForMana') {
        send({
          t: 'TapForMana',
          player: viewer,
          card: id,
          abilityIndex: tap.abilityIndex,
          outputChoice: 0,
        });
        return;
      }

      // An Equipment or Aura with nothing else to do: point it at what it should
      // go on. The SAME mode the drag opens, so clicking and dragging cannot end
      // up meaning different things.
      const attach = attachableAs(view, id, viewer);
      if (attach) {
        setMode({ kind: 'attach', card: id, name: attach.name, creaturesOnly: attach.creaturesOnly });
        beginAimFrom(id);
      }
    },
    [awaiting, legal, mode, send, setMode, view, viewer],
  );

  /** The attachment tab on a permanent: show what is on it. */
  const onAttachmentsClick = useCallback(
    (host: InstanceId, x: number, y: number) => {
      if (!session.isRunning()) return;
      useTable.getState().openAttachments(host, x, y);
    },
    [],
  );

  const onCardContextMenu = useCallback(
    (id: InstanceId, x: number, y: number) => {
      if (!session.isRunning()) return;
      openCardMenu(id, x, y);
    },
    [openCardMenu],
  );

  /**
   * Press an Equipment or an Aura on my battlefield and drag: the arrow comes
   * out of it and only what it can go on is clickable.
   *
   * ⚠️ It hands the gesture STRAIGHT OVER to `useAimGesture` once the threshold
   * is passed — `viaDrag: true` is what makes the pointerup commit — rather than
   * running a second drag machine beside it. Below the threshold nothing
   * happens, so a plain click still reaches `onCardClick`.
   *
   * ⚠️ WINDOW listeners and no React state, for `useHandDrag`'s reasons: the
   * card's element is re-keyed by a re-pack the moment the veil opens, and
   * capture on an element that changes under you drops the rest of the gesture.
   */
  const onCardPointerDown = useCallback(
    (id: InstanceId, e: { button: number; clientX: number; clientY: number; pointerId: number }) => {
      if (!session.isRunning() || e.button !== 0) return;
      if (useTable.getState().mode.kind !== 'idle') return;
      const what = attachableAs(useGame.getState().view, id, useTable.getState().viewer);
      if (!what) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const ac = new AbortController();
      const stop = (): void => ac.abort();

      const onMove = (ev: PointerEvent): void => {
        if (ev.pointerId !== e.pointerId) return;
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < ATTACH_DRAG_PX) return;
        stop();
        useTable.getState().setMode({ kind: 'attach', card: id, name: what.name, creaturesOnly: what.creaturesOnly });
        useAim.getState().begin({
          sourceKey: cardSlot(id),
          sourceRect: resolveKey(cardSlot(id)),
          viaDrag: true,
        });
      };

      window.addEventListener('pointermove', onMove, { signal: ac.signal });
      window.addEventListener('pointerup', stop, { signal: ac.signal });
      window.addEventListener('pointercancel', stop, { signal: ac.signal });
      window.addEventListener('blur', stop, { signal: ac.signal });
    },
    [],
  );

  /**
   * May this card be dropped on my battlefield, and what does the ghost say?
   *
   * ⚠️ Read from `legal`, never guessed. The one thing this adds is a REASON when
   * the answer is no, and even that is taken from what the view already says
   * (whose priority it is) rather than re-deriving a rule the engine owns. A
   * second opinion about legality is how you get a card that lights up and then
   * bounces.
   */
  const dropCheck = useCallback(
    (id: InstanceId): DropCheck => {
      if (!session.isRunning()) return { ok: false, hint: null };

      // Mid-declaration, a drop is not the gesture being asked for.
      if (mode.kind === 'attackers') return { ok: false, hint: 'Choosing attackers.' };
      if (mode.kind === 'blockers') return { ok: false, hint: 'Choosing blocks.' };
      if (mode.kind === 'targeting') return { ok: false, hint: 'Choosing targets.' };
      if (mode.kind === 'payment') return { ok: false, hint: 'Finish the spell you are casting.' };
      if (awaiting?.kind === 'mulligan' && awaiting.players.includes(viewer)) {
        return { ok: false, hint: 'Keep this hand or mulligan first.' };
      }
      if (awaiting?.kind === 'mulliganBottom' && awaiting.player === viewer) {
        return { ok: false, hint: 'Put cards on the bottom first.' };
      }

      const land = legal.find((a) => a.t === 'PlayLand' && a.card === id);
      if (land?.t === 'PlayLand') return { ok: true, hint: `Play ${land.label}` };

      const cast = legal.find((a) => a.t === 'CastSpell' && a.card === id);
      if (cast?.t === 'CastSpell') {
        if (!cast.affordable && !cast.hasX) {
          return { ok: false, hint: `Not enough mana for ${cast.label}.` };
        }
        return { ok: true, hint: `Cast ${cast.label}` };
      }

      if (view.priority !== viewer) {
        const who = seats.find((s) => s.id === view.priority)?.name ?? 'Someone else';
        return { ok: false, hint: `${who} has priority.` };
      }
      return { ok: false, hint: `You can't play ${nameOf(view, id)} right now.` };
    },
    [awaiting, legal, mode, seats, view, viewer],
  );

  /**
   * A card was dragged out of the hand and let go over my side of the table.
   *
   * It plays exactly what a click plays — a land goes straight down, a spell opens
   * the payment review — because there must not be two answers to "what does
   * playing this card do". The drop's own contribution is the RECT: the flight
   * starts from where the player let go rather than from the hand slot the card
   * has not visibly occupied since the drag began.
   */
  const onCardDrop = useCallback(
    (id: InstanceId, rect: FrozenRect) => {
      const check = dropCheck(id);
      if (!check.ok) {
        useTable.getState().setMessage(check.hint ?? "You can't play that right now.");
        useDrag.getState().returnHome();
        return;
      }

      const land = legal.find((a) => a.t === 'PlayLand' && a.card === id);
      if (land) {
        setDropOrigin(id, rect);
        send({ t: 'PlayLand', player: viewer, card: id });
        return; // the ghost stays parked until the card leaves the fan
      }

      const cast = legal.find((a) => a.t === 'CastSpell' && a.card === id);
      if (cast) {
        // Parked over the battlefield while you approve the payment — the card is
        // on the table, waiting, which is what the gesture said it should be.
        if (cast.t === 'CastSpell' && beginAim({ kind: 'spell', card: id }, cast.label, 'payment')) return;
        setMode({ kind: 'payment', card: id, xValue: 0, targets: [] });
        return;
      }

      useDrag.getState().returnHome();
    },
    [dropCheck, legal, send, setMode, viewer],
  );

  // ── The parked ghost's lifetime ────────────────────────────────────────────
  //
  // A dropped card is hidden in the fan and drawn by the drag layer instead, so
  // something must always put it back. Exactly three things end a park:
  //
  //  1. the card leaves my hand — a flight owns it now. ⚠️ This runs on the view
  //     COMMIT, synchronously, not on a timer: a poll would leave the ghost and
  //     the flight clone both on screen for a frame or two, which reads as the
  //     card having been duplicated.
  //  2. the payment review it opened is closed without casting.
  //  3. nothing happens for PARK_MS — the floor under a refused intent.
  useEffect(() => {
    let timer: number | null = null;
    const clearTimer = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const arm = (): void => {
      clearTimer();
      timer = window.setTimeout(() => {
        timer = null;
        const drag = useDrag.getState();
        if (drag.phase !== 'released') return;
        const m = useTable.getState().mode;
        // Still mid-cast for this very card: keep waiting.
        //
        // ⚠️ `targeting` belongs in here as much as `payment` does. Once targets
        // are chosen BEFORE payment, a spell dragged out of hand spends its first
        // seconds in `targeting` — and without this clause the ghost flew home
        // 900 ms into aiming, while the veil was still up. It only shows up if
        // you drag rather than click, which is exactly how it would have shipped.
        if ((m.kind === 'payment' || m.kind === 'targeting') && castCardOf(m) === drag.instanceId) {
          arm();
          return;
        }
        drag.returnHome();
      }, PARK_MS);
    };

    const unsubView = useGame.subscribe((state) => {
      const drag = useDrag.getState();
      if (drag.phase !== 'released' || !drag.instanceId) return;
      // ⚠️ BOTH zones a drag can start from. Checking only the hand left a
      // commander's ghost parked on the battlefield after it had already been
      // cast — the real card and the ghost on screen together until the 900 ms
      // floor swept it up, which reads as the commander having been duplicated.
      const me = state.view.me;
      const stillThere =
        zoneCards(state.view, zoneId('hand', me)).includes(drag.instanceId)
        || zoneCards(state.view, zoneId('cmd', me)).includes(drag.instanceId);
      if (!stillThere) drag.reset();
    });

    const unsubDrag = useDrag.subscribe((s, prev) => {
      if (s.phase === 'released' && prev.phase !== 'released') arm();
      else if (s.phase !== 'released') clearTimer();
    });

    return () => {
      clearTimer();
      unsubView();
      unsubDrag();
    };
  }, []);

  return { onCardClick, onCardContextMenu, onCardPointerDown, onAttachmentsClick, onCardDrop, dropCheck, send };
}

/** The card's current face name, for a message about a card the player can see. */
function nameOf(view: PlayerView, id: InstanceId): string {
  const c = view.cards[id];
  if (!c?.card) return 'that card';
  return c.card.faces[c.faceIndex]?.name ?? c.card.faces[0]?.name ?? 'that card';
}

/**
 * Hand the parked card's rect to the flight layer as this flight's source.
 *
 * Called at the moment an intent is actually submitted, which for a spell is when
 * the payment review is confirmed — possibly seconds after the drop. The origin
 * has a short TTL by design, so it must be set then and not at drop time.
 */
export function handOffDropOrigin(instanceId: InstanceId): void {
  const drag = useDrag.getState();
  if (drag.phase !== 'released' || drag.instanceId !== instanceId) return;
  setDropOrigin(instanceId, { left: drag.x, top: drag.y, width: drag.w, height: drag.h });
}

/** Instance ids highlighted right now, so the table can outline them. */
export function highlightedIds(): Set<string> {
  const { mode } = useTable.getState();
  if (mode.kind === 'attackers') return new Set(mode.chosen.map((a) => a.card));
  if (mode.kind === 'blockers') {
    const ids = mode.blocks.flatMap((b) => [b.blocker, b.attacker]);
    if (mode.pendingBlocker) ids.push(mode.pendingBlocker);
    return new Set(ids);
  }
  if (mode.kind === 'payment') {
    const preview = session.previewCast(mode.card, mode.xValue, mode.targets);
    return new Set([mode.card, ...(preview?.taps ?? [])]);
  }
  return new Set();
}
