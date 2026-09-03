import { useEffect, useState } from 'react';
import { AimVeil } from './AimVeil';
import { AttachmentsPanel, CardMenu, ManualToolsDrawer } from './ManualTools';
import { ManaChoicePanel } from './ManaChoice';
import { FaceChoicePanel } from './FaceChoice';
import { LibraryMenu, PeekPanel } from './LibraryPanels';
import { ZoneBrowser } from './ZoneBrowser';
import { NumberDialog, TextDialog } from './Dialogs';
import { PaymentReview } from './PaymentReview';
import { PromptBar } from './PromptBar';
import { SeatHandoff } from './SeatHandoff';
import { SkipHint } from './SkipHint';
import { StopsPanel } from './StopsPanel';
import { BTN_GHOST_SMALL } from './styles';
import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { useAimGesture } from './useAimGesture';
import { chosenIdsFor, onVeilPick } from './aimCommit';
import { bandFor, zoneCards, zoneId } from '../../view/types';
import type { CardData } from '../../data/cardTypes';
import type { StopPolicy, TargetChoice } from '../../engine/types/state';

// Everything the engine adds on top of the M2 table, in one overlay.
//
// ⚠️ It sits ABOVE `GameTable` and never inside it. Nothing in `src/ui/table/`
// or `src/ui/anim/` knows an engine exists — that is the M2↔M3 seam holding,
// and it is what lets the animation battery keep driving the same components
// through fixtures.

export function GameLayer({
  tokens,
  stops,
}: {
  tokens: readonly CardData[];
  stops: StopPolicy | null;
}) {
  const running = useTable((s) => s.running);
  const viewer = useTable((s) => s.viewer);
  const seats = useTable((s) => s.seats);
  const escape = useTable((s) => s.escape);
  const [targets, setTargets] = useState<readonly TargetChoice[]>([]);
  const mode = useTable((s) => s.mode);
  const epoch = useGame((s) => s.epoch);
  const view = useGame((s) => s.view);

  // ⚠️ Recomputed on every view commit, not just when the mode changes. It used
  // to depend on `[mode.kind]` alone while the veil re-measured on `view`, so
  // during an aim the rings moved with the board and never re-legalised — a
  // creature that died mid-aim kept its legal ring, and at four players an
  // opponent acting mid-aim is entirely ordinary.
  const awaiting = useTable((s) => s.awaiting);
  const legal = useTable((s) => s.legal);
  useEffect(() => {
    if (mode.kind === 'targeting') {
      setTargets(session.legalTargetsFor(mode.specs, mode.source.card));
      return;
    }
    // The sacrifice pick (D168): the candidates come off the CURRENT legal
    // action — computed host-side by `sacrificeCandidatesFor` and re-offered
    // on every commit — so a candidate that died mid-pick stops being
    // clickable, and the veil can never offer what the engine would refuse.
    // An ability that left `legal` entirely offers nothing; Escape backs out.
    if (mode.kind === 'sacrifice') {
      const live = legal.find(
        (a) => a.t === 'ActivateAbility' && a.card === mode.card && a.abilityIndex === mode.abilityIndex,
      );
      const candidates = live?.t === 'ActivateAbility' ? (live.sacrificeCandidates ?? []) : [];
      setTargets(candidates.map((id) => ({ kind: 'card' as const, id })));
      return;
    }
    // The cost pick (D286): the candidates come off the CURRENT legal action
    // too, minus what is already chosen, so a card that left the hand or a
    // permanent that got tapped mid-pick stops being clickable.
    if (mode.kind === 'costPick') {
      const live = legal.find(
        (a) => a.t === 'ActivateAbility' && a.card === mode.card && a.abilityIndex === mode.abilityIndex,
      );
      const pool =
        live?.t === 'ActivateAbility'
          ? ((mode.verb === 'discard' ? live.discardCandidates : live.tapCandidates) ?? [])
          : [];
      setTargets(pool.filter((id) => !mode.chosen.includes(id)).map((id) => ({ kind: 'card' as const, id })));
      return;
    }
    // Blocking is the same overlay with a different legal set, and it has TWO
    // stages: pick one of your creatures, then pick what it blocks.
    //
    // ⚠️ The pairing comes from `Awaiting.declareBlockers.legal`, computed
    // host-side by `canBlock`. A client cannot work out that a Giant Spider may
    // block a flier but a Grizzly Bears may not — that needs derived keywords
    // off a `GameState` no client holds.
    if (mode.kind === 'blockers' && awaiting?.kind === 'declareBlockers') {
      const rows = awaiting.legal.filter((r) => view.cards[r.blocker]?.controller === viewer);
      if (mode.pendingBlocker === null) {
        const taken = new Set(mode.blocks.map((b) => b.blocker));
        setTargets(
          rows.filter((r) => !taken.has(r.blocker)).map((r) => ({ kind: 'card' as const, id: r.blocker })),
        );
        return;
      }
      const row = rows.find((r) => r.blocker === mode.pendingBlocker);
      setTargets((row?.attackers ?? []).map((id) => ({ kind: 'card' as const, id })));
      return;
    }
    // Attaching: the hosts are MY permanents — creatures for an Equipment,
    // anything for an Aura, and never the attachment itself or what it is
    // already on.
    //
    // ⚠️ Decided from the type line, not from a rules engine. This is a Tier-3
    // tool: it exists to move an attachment where the player says, and the
    // narrower list is only there so the veil does not offer a Forest to a sword.
    if (mode.kind === 'attach') {
      const attachment = view.cards[mode.card];
      setTargets(
        zoneCards(view, zoneId('bf', viewer))
          .filter((id) => {
            if (id === mode.card || id === attachment?.attachedTo) return false;
            const host = view.cards[id];
            if (!host || host.attachedTo) return false;
            return !mode.creaturesOnly || bandFor(host.card, host.faceIndex).band === 'combat';
          })
          .map((id) => ({ kind: 'card' as const, id })),
      );
      return;
    }
    setTargets([]);
  }, [mode, epoch, awaiting, legal, view, viewer]);

  // ⚠️ Escape backs out ONE step. A player halfway through declaring five
  // attackers who taps Escape to close a menu must not lose the five.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      escape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [escape]);

  useAimGesture();

  if (!running) return null;

  return (
    <>
      <AimVeil
        active={
          mode.kind === 'targeting' ||
          mode.kind === 'blockers' ||
          mode.kind === 'attach' ||
          mode.kind === 'sacrifice' ||
          mode.kind === 'costPick'
        }
        legalTargets={targets}
        chosenIds={chosenIdsFor(mode)}
        onPick={(choice) => onVeilPick(choice)}
      />

      {/* Hotseat seat picker. Solo play IS a hotseat: the table follows whoever
          the game is waiting on, and this is how you look at someone else. */}
      <div className="absolute right-2 top-2 z-[960] flex items-center gap-1" data-seat-picker="">
        {seats.map((seat) => (
          <button
            key={seat.id}
            type="button"
            className={BTN_GHOST_SMALL}
            data-seat={seat.id}
            aria-pressed={seat.id === viewer}
            style={seat.id === viewer ? { borderColor: 'var(--color-crt-accent)' } : undefined}
            onClick={() => session.setViewer(seat.id)}
          >
            {seat.name}
          </button>
        ))}
      </div>

      <StopsPanel stops={stops} />
      <ManualToolsDrawer tokens={tokens} />
      <PaymentReview />
      <PromptBar />
      <SeatHandoff />
      <SkipHint />
      <CardMenu />
      <AttachmentsPanel />
      <ManaChoicePanel />
      <FaceChoicePanel />
      <LibraryMenu />
      <PeekPanel />
      <ZoneBrowser />
      <NumberDialog />
      <TextDialog />
    </>
  );
}
