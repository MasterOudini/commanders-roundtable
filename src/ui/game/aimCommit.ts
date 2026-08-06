import * as session from '../../game/session';
import { useAim } from '../../store/aimStore';
import { cardSlot, resolveKey } from '../anim/rectRegistry';
import { useTable, type TableMode } from '../../store/tableStore';
import type { TargetChoice } from '../../engine/types/state';

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
    useAim.getState().reset();
    table.setMode({ kind: 'idle' });
    if (choice.kind !== 'card') return;
    session.submit({
      t: 'ActivateAbility',
      player: table.viewer,
      card: mode.card,
      abilityIndex: mode.abilityIndex,
      sacrifice: choice.id,
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
  ability: { readonly abilityIndex: number; readonly name: string; readonly needsSacrifice: boolean },
): void {
  const table = useTable.getState();
  if (ability.needsSacrifice) {
    table.setMode({ kind: 'sacrifice', card, abilityIndex: ability.abilityIndex, name: ability.name });
    beginAimFrom(card);
    return;
  }
  const specs = session.targetSpecsFor(card, ability.abilityIndex);
  const max = specs.reduce((n, s) => n + s.max, 0);
  if (specs.length > 0 && max > 0) {
    const min = specs.reduce((n, s) => n + s.min, 0);
    table.setMode({
      kind: 'targeting',
      source: { kind: 'ability', card, abilityIndex: ability.abilityIndex },
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
  session.submit({ t: 'ActivateAbility', player: table.viewer, card, abilityIndex: ability.abilityIndex });
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
      targets: [...mode.chosen],
    });
    table.setMode({ kind: 'idle' });
    return;
  }

  // ⚠️ The targets travel WITH the payment mode, because `previewCast` prices the
  // ward surcharge from them. Dropping them here is what used to make ward
  // unreachable from the UI entirely.
  table.setMode({ kind: 'payment', card: mode.source.card, xValue: 0, targets: [...mode.chosen] });
}
