import * as session from '../../game/session';
import { useAim } from '../../store/aimStore';
import { cardSlot, resolveKey } from '../anim/rectRegistry';
import { useTable, type TableMode } from '../../store/tableStore';
import type { TargetChoice } from '../../engine/types/state';
import type { CostPicks } from '../../net/client';
import type { LegalAction } from '../../engine/legal';

// Adding a target, and finishing an aim. ONE implementation, because three
// things do it — clicking a legal target on the veil, releasing a drag on one,
// and the prompt bar's Done — and three copies of "is that enough targets yet?"
// would disagree the first time one of them changed.

function sameChoice(a: TargetChoice, b: TargetChoice): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * The prompt line, written from the player's side.
 *
 * ⚠️ Tolerates a mode with no `specs`. This is reachable from the dev handles,
 * which a battery drives by hand, and a prompt bar that THROWS takes the whole
 * render tree with it — the first run of this crashed React on a mode object
 * that was merely out of date, and the resulting failure list blamed four
 * unrelated checks.
 */
export function aimPrompt(mode: Extract<TableMode, { kind: 'targeting' }>): string {
  const clause = (mode.specs ?? []).find((s) => s.text !== '')?.text ?? 'a target';
  const n = mode.chosen.length;
  if (mode.max === 1) return `Choose ${clause} for ${mode.name}`;
  if (mode.min === mode.max) return `Choose ${clause} for ${mode.name} — ${n + 1} of ${mode.max}`;
  return `Choose up to ${mode.max} for ${mode.name} — ${n} chosen`;
}

/**
 * Add one target, and finish the aim if that was the last one it wanted.
 *
 * ⚠️ Auto-advancing at `max` is Arena's behaviour and covers the overwhelmingly
 * common case — one target, one click, no confirmation step.
 */
export function pickTarget(choice: TargetChoice): void {
  const table = useTable.getState();
  const mode = table.mode;
  if (mode.kind !== 'targeting') return;
  const already = mode.chosen.some((c) => sameChoice(c, choice));
  const chosen = already
    ? mode.chosen.filter((c) => !sameChoice(c, choice))
    : [...mode.chosen, choice].slice(0, mode.max);
  table.setMode({ ...mode, chosen });
  if (!already && chosen.length >= mode.max) commitTargets();
}

/** Everything already picked, so the veil can ring it. Ids only — kinds do not collide here. */
export function chosenIdsFor(mode: TableMode): ReadonlySet<string> {
  if (mode.kind === 'targeting') return new Set(mode.chosen.map((c) => c.id));
  if (mode.kind === 'proliferate') return new Set(mode.chosen.map((c) => c.id));
  if (mode.kind === 'blockers') {
    const ids = mode.blocks.flatMap((b) => [b.blocker, b.attacker]);
    if (mode.pendingBlocker) ids.push(mode.pendingBlocker);
    return new Set(ids);
  }
  return new Set();
}

/**
 * What clicking a legal thing on the veil MEANS, per mode.
 *
 * ⚠️ Blocking is two picks, not one: your creature, then what it blocks. The
 * arrow is started on the first and committed on the second, which is why the
 * aim store is driven from here rather than from the click handler — one place
 * decides, so the veil and the drag gesture cannot disagree about which stage
 * the player is in.
 */
export function onVeilPick(choice: TargetChoice): void {
  const table = useTable.getState();
  const mode = table.mode;

  // The sacrifice pick is one pick: what the cost eats (D168). ⚠️ Unlike the
  // attach branch below this is TIER 1 — the pick rides the `ActivateAbility`
  // intent, and the host re-validates it with `sacrificeCandidatesFor` before
  // charging, so a stale click costs a refusal message and never a permanent.
  if (mode.kind === 'sacrifice') {
    // D353 - N picks, the cost pick's rule: a repeat is ignored, and only the last one
    // submits. One permanent is the same branch with a count of 1.
    if (choice.kind !== 'card' || mode.chosen.includes(choice.id)) return;
    const chosen = [...mode.chosen, choice.id];
    if (chosen.length < mode.count) {
      table.setMode({ ...mode, chosen });
      return;
    }
    useAim.getState().reset();
    // D406 - a CAST's sacrifice: the picks ride on to the targets and the payment review.
    if (mode.cast) {
      continueCast(mode.card, mode.cast, { sacrifice: chosen });
      return;
    }
    table.setMode({ kind: 'idle' });
    session.submit({
      t: 'ActivateAbility',
      player: table.viewer,
      card: mode.card,
      abilityIndex: mode.abilityIndex,
      ...(mode.grantRef !== undefined ? { grantRef: mode.grantRef } : {}),
      sacrifice: chosen,
    });
    return;
  }

  // The cost pick (D286) is N picks: the cards a "Discard N" cost takes or
  // the permanents a "Tap N untapped …" cost taps. TIER 1 like the
  // sacrifice: the picks ride the intent and the host re-validates them, so
  // a stale click costs a refusal message and never a card.
  if (mode.kind === 'costPick') {
    if (choice.kind !== 'card' || mode.chosen.includes(choice.id)) return;
    const chosen = [...mode.chosen, choice.id];
    if (chosen.length < mode.count) {
      table.setMode({ ...mode, chosen });
      return;
    }
    useAim.getState().reset();
    // D406 - a CAST's cost pick: the picks ride on to the targets and the payment review.
    if (mode.cast) {
      continueCast(mode.card, mode.cast, mode.verb === 'discard' ? { discard: chosen } : mode.verb === 'tap' ? { tap: chosen } : mode.verb === 'returnToHand' ? { returnToHand: chosen } : mode.verb === 'exileFromHand' ? { exileFromHand: chosen } : { exileFromGraveyard: chosen });
      return;
    }
    table.setMode({ kind: 'idle' });
    session.submit({
      t: 'ActivateAbility',
      player: table.viewer,
      card: mode.card,
      abilityIndex: mode.abilityIndex,
      ...(mode.grantRef !== undefined ? { grantRef: mode.grantRef } : {}),
      ...(mode.verb === 'discard'
        ? { discard: chosen }
        : mode.verb === 'tap'
          ? { tap: chosen }
          : mode.verb === 'returnToHand'
            ? { returnToHand: chosen }
            : mode.verb === 'removeCounter'
              ? { removeCounter: chosen }
              : { exileFromGraveyard: chosen }),
    });
    return;
  }

  // D390 - the queued sacrifice's answer: N permanents, then `AnswerChooseFromZone`. TIER 1 like
  // the picks above - the host re-validates every id against the derived board.
  if (mode.kind === 'boardPick') {
    if (choice.kind !== 'card' || mode.chosen.includes(choice.id)) return;
    const chosen = [...mode.chosen, choice.id];
    if (chosen.length < mode.count) {
      table.setMode({ ...mode, chosen });
      return;
    }
    useAim.getState().reset();
    table.setMode({ kind: 'idle' });
    session.submit({ t: 'AnswerChooseFromZone', player: table.viewer, cards: chosen });
    return;
  }

  // D391 - proliferate: a TOGGLE over permanents and players; the prompt bar's button commits,
  // because choosing none is a legal answer and no click can be the last one.
  if (mode.kind === 'proliferate') {
    if (choice.kind !== 'card' && choice.kind !== 'player') return;
    // Structural, not `typeof choice`: the guard above narrowed the pick to card|player, and the
    // chosen list still holds the whole TargetChoice union.
    const same = (c: { readonly kind: string; readonly id: string }): boolean => c.kind === choice.kind && c.id === choice.id;
    table.setMode({
      ...mode,
      chosen: mode.chosen.some(same) ? mode.chosen.filter((c) => !same(c)) : [...mode.chosen, choice],
    });
    return;
  }

  // Attaching is one pick: the host. ⚠️ It goes out as `ManualAttach`, a Tier-3
  // tool — the engine moves the attachment and logs it, and the equip COST and
  // its sorcery-speed timing remain the player's, because `Equip {2}` is not an
  // ability the engine can charge. Dressing this up as an enforced equip would
  // be the lie `activatedParse.ts` exists to avoid.
  if (mode.kind === 'attach') {
    useAim.getState().reset();
    table.setMode({ kind: 'idle' });
    if (choice.kind !== 'card' || choice.id === mode.card) return;
    session.submit({ t: 'ManualAttach', player: table.viewer, card: mode.card, to: choice.id });
    return;
  }

  if (mode.kind === 'blockers') {
    if (mode.pendingBlocker === null) {
      table.setMode({ ...mode, pendingBlocker: choice.id });
      beginAimFrom(choice.id);
      return;
    }
    if (mode.pendingBlocker === choice.id) {
      table.setMode({ ...mode, pendingBlocker: null });
      useAim.getState().reset();
      return;
    }
    table.setMode({
      kind: 'blockers',
      blocks: [...mode.blocks, { blocker: mode.pendingBlocker, attacker: choice.id }],
      pendingBlocker: null,
    });
    useAim.getState().reset();
    return;
  }

  pickTarget(choice);
}

/** Pin the arrow's tail to a card already on the table. */
export function beginAimFrom(cardId: string): void {
  useAim.getState().begin({
    sourceKey: cardSlot(cardId),
    sourceRect: resolveKey(cardSlot(cardId)),
    viaDrag: false,
  });
}

/**
 * Activate one of a permanent's abilities — the click a panel row sends.
 *
 * ⚠️ ONE implementation, this file's rule: what activating MEANS — pick a
 * sacrifice, aim its targets, or go straight to the engine — must not be
 * re-decided by every control that offers an ability.
 *
 * ⚠️ The sacrifice pick comes first and the branches are exclusive: no def
 * shipping today carries BOTH a sacrifice cost and a target clause, and
 * `legal.ts` cannot offer such an ability until one does. When one ships, the
 * pick must CHAIN into targeting (carry `sacrifice` through the targeting
 * mode) — submitting with either half missing is refused by the host
 * (`needsSacrifice` / target validation), so the gap fails safe with a
 * message rather than silently.
 */
export function startActivation(
  card: string,
  ability: {
    readonly abilityIndex: number;
    /** D367 - a granted ability's ref (absent for the permanent's own printed ones). */
    readonly grantRef?: string;
    readonly name: string;
    readonly needsSacrifice: number;
    readonly needsDiscard?: number;
    readonly needsTap?: number;
    readonly needsExileFromGraveyard?: number;
    readonly needsReturn?: number;
    readonly needsRemoveCounter?: number;
  },
): void {
  const table = useTable.getState();
  if (ability.needsSacrifice > 0) {
    table.setMode({
      kind: 'sacrifice',
      card,
      abilityIndex: ability.abilityIndex,
      ...(ability.grantRef !== undefined ? { grantRef: ability.grantRef } : {}),
      name: ability.name,
      count: ability.needsSacrifice,
      chosen: [],
    });
    beginAimFrom(card);
    return;
  }
  // A discard or tap cost (D286) is picked BEFORE the engine is asked, the
  // sacrifice pick N times over; an ability with targets as well submits the
  // picks alone and lets the host raise its targets prompt.
  const needsDiscard = ability.needsDiscard ?? 0;
  const needsTap = ability.needsTap ?? 0;
  // D329 - the third pick: the graveyard cards an "Exile N ... from your graveyard" cost takes.
  const needsExileGy = ability.needsExileFromGraveyard ?? 0;
  const needsReturn = ability.needsReturn ?? 0;
  // D363 - the fifth verb: the counters a "Remove N ... from a <predicate> you
  // control" cost takes. ⚠️ Its picks are a MULTISET, so the panel may name one
  // permanent twice where every other verb names each at most once.
  const needsRemoveCounter = ability.needsRemoveCounter ?? 0;
  if (needsDiscard > 0 || needsTap > 0 || needsExileGy > 0 || needsReturn > 0 || needsRemoveCounter > 0) {
    const verb = needsDiscard > 0 ? 'discard' : needsTap > 0 ? 'tap' : needsReturn > 0 ? 'returnToHand' : needsRemoveCounter > 0 ? 'removeCounter' : 'exileFromGraveyard';
    table.setMode({
      kind: 'costPick',
      card,
      abilityIndex: ability.abilityIndex,
      ...(ability.grantRef !== undefined ? { grantRef: ability.grantRef } : {}),
      name: ability.name,
      verb,
      count:
        verb === 'discard'
          ? needsDiscard
          : verb === 'tap'
            ? needsTap
            : verb === 'returnToHand'
              ? needsReturn
              : verb === 'removeCounter'
                ? needsRemoveCounter
                : needsExileGy,
      chosen: [],
    });
    beginAimFrom(card);
    return;
  }
  const specs = session.targetSpecsFor(card, ability.abilityIndex, ability.grantRef);
  const max = specs.reduce((n, s) => n + s.max, 0);
  if (specs.length > 0 && max > 0) {
    const min = specs.reduce((n, s) => n + s.min, 0);
    table.setMode({
      kind: 'targeting',
      source: { kind: 'ability', card, abilityIndex: ability.abilityIndex, ...(ability.grantRef !== undefined ? { grantRef: ability.grantRef } : {}) },
      name: ability.name,
      chosen: [],
      specs,
      min,
      max,
      next: 'submit',
    });
    beginAimFrom(card);
    return;
  }
  session.submit({
    t: 'ActivateAbility',
    player: table.viewer,
    card,
    abilityIndex: ability.abilityIndex,
    ...(ability.grantRef !== undefined ? { grantRef: ability.grantRef } : {}),
  });
}

/** Finish aiming: on to payment for a spell, or straight to the engine for an ability. */
export function commitTargets(): void {
  const table = useTable.getState();
  const mode = table.mode;
  if (mode.kind !== 'targeting') return;
  useAim.getState().reset();

  // Answering a prompt the ENGINE raised (D169): a trigger's targets
  // (CR 603.3d), or the staged targets of a sacrifice-cost activation. The
  // intent names no stack object — the host reads its own live awaiting.
  if (mode.next === 'answer') {
    session.submit({ t: 'ChooseTargets', player: table.viewer, targets: [...mode.chosen] });
    table.setMode({ kind: 'idle' });
    return;
  }

  if (mode.next === 'submit' && mode.source.kind === 'ability') {
    session.submit({
      t: 'ActivateAbility',
      player: table.viewer,
      card: mode.source.card,
      abilityIndex: mode.source.abilityIndex,
      ...(mode.source.grantRef !== undefined ? { grantRef: mode.source.grantRef } : {}),
      targets: [...mode.chosen],
    });
    table.setMode({ kind: 'idle' });
    return;
  }

  // ⚠️ The targets travel WITH the payment mode, because `previewCast` prices the
  // ward surcharge from them. Dropping them here is what used to make ward
  // unreachable from the UI entirely.
  // D406 - the additional cost's picks, chosen before the targets, reach the review with them.
  table.setMode({ kind: 'payment', card: mode.source.card, xValue: 0, targets: [...mode.chosen], ...(mode.costPicks ? { costPicks: mode.costPicks } : {}) });
}

/**
 * D406 - a cast whose face prints an additional cost with a CHOOSER verb starts by naming the picks:
 * the same `sacrifice` / `costPick` modes an activation uses, marked `cast`, with the candidates read
 * off the CastSpell action (`GameLayer`). Returns false when the cast has no such pick to make (no
 * verb, or the `or pay {M}` alternative stands in because the candidates fall short).
 */
export function beginCastPicks(card: string, cast: Extract<LegalAction, { t: 'CastSpell' }>, faceIndex?: number): boolean {
  const table = useTable.getState();
  const castMark = { ...(faceIndex !== undefined ? { faceIndex } : {}), label: cast.label };
  if (cast.sacrificeCandidates && cast.sacrificeCount !== undefined && cast.sacrificeCandidates.length >= cast.sacrificeCount) {
    table.setMode({ kind: 'sacrifice', card, abilityIndex: 0, cast: castMark, name: cast.label, count: cast.sacrificeCount, chosen: [] });
    beginAimFrom(card);
    return true;
  }
  const verb: { verb: 'discard' | 'tap' | 'exileFromGraveyard' | 'returnToHand'; count: number; have: number } | null =
    cast.discardCandidates && cast.discardCount !== undefined ? { verb: 'discard', count: cast.discardCount, have: cast.discardCandidates.length }
    : cast.tapCandidates && cast.tapCount !== undefined ? { verb: 'tap', count: cast.tapCount, have: cast.tapCandidates.length }
    : cast.exileFromGraveyardCandidates && cast.exileFromGraveyardCount !== undefined ? { verb: 'exileFromGraveyard', count: cast.exileFromGraveyardCount, have: cast.exileFromGraveyardCandidates.length }
    : cast.returnCandidates && cast.returnCount !== undefined ? { verb: 'returnToHand', count: cast.returnCount, have: cast.returnCandidates.length }
    : null;
  if (!verb || verb.have < verb.count) return false;
  table.setMode({ kind: 'costPick', card, abilityIndex: 0, cast: castMark, name: cast.label, verb: verb.verb, count: verb.count, chosen: [] });
  beginAimFrom(card);
  return true;
}

/**
 * D408 - the review elects the ALTERNATIVE cost: one that needs no pick flips the review's flag; one that
 * needs a pick (a verb or the pitch) goes through the pick modes marked `cast.alt`, the veil reading the
 * offer's `altPickCandidates`, and comes back to the review elected with the picks.
 */
export function electAlternative(card: string, faceIndex: number | undefined, label: string, targets: readonly TargetChoice[], pick: { readonly verb: string | null; readonly count: number }): void {
  const table = useTable.getState();
  const castMark = { ...(faceIndex !== undefined ? { faceIndex } : {}), label, alt: true as const, targets };
  if (pick.verb === null) {
    table.setMode({ kind: 'payment', card, ...(faceIndex !== undefined ? { faceIndex } : {}), xValue: 0, targets, alternative: true });
    return;
  }
  if (pick.verb === 'sacrifice') {
    table.setMode({ kind: 'sacrifice', card, abilityIndex: 0, cast: castMark, name: label, count: pick.count, chosen: [] });
  } else {
    const verb = pick.verb === 'discard' || pick.verb === 'tap' || pick.verb === 'exileFromGraveyard' || pick.verb === 'returnToHand' || pick.verb === 'exileFromHand' ? pick.verb : 'discard';
    table.setMode({ kind: 'costPick', card, abilityIndex: 0, cast: castMark, name: label, verb, count: pick.count, chosen: [] });
  }
  beginAimFrom(card);
}

/** D406 - after the picks: the targets (with the picks riding along), or straight to the payment review. */
function continueCast(card: string, cast: { readonly faceIndex?: number; readonly label: string; readonly alt?: true; readonly targets?: readonly TargetChoice[] }, costPicks: CostPicks): void {
  const table = useTable.getState();
  // D408 - the alternative cost's pick was made FROM the review (the targets already chosen): back to it, elected.
  if (cast.alt) {
    table.setMode({ kind: 'payment', card, ...(cast.faceIndex !== undefined ? { faceIndex: cast.faceIndex } : {}), xValue: 0, targets: cast.targets ?? [], costPicks, alternative: true });
    return;
  }
  const specs = session.targetSpecsFor(card);
  const max = specs.reduce((n, s) => n + s.max, 0);
  if (specs.length > 0 && max > 0) {
    const min = specs.reduce((n, s) => n + s.min, 0);
    table.setMode({ kind: 'targeting', source: { kind: 'spell', card }, name: cast.label, chosen: [], specs, min, max, next: 'payment', costPicks });
    beginAimFrom(card);
    return;
  }
  table.setMode({ kind: 'payment', card, ...(cast.faceIndex !== undefined ? { faceIndex: cast.faceIndex } : {}), xValue: 0, targets: [], costPicks });
}
