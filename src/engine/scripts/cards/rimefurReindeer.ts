// `Rimefur Reindeer` — "Whenever an enchantment you control enters, tap
// target creature an opponent controls." Mm'menon's controlled-entry
// pair with the entrant typed ENCHANTMENT, and the target's opponent
// restriction ENFORCED by the aim layer (probed, D240).

import { RIMEFUR_REINDEER } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const TEXT = printed(
  RIMEFUR_REINDEER,
  'Whenever an enchantment you control enters, tap target creature an opponent controls.',
);

/** "an enchantment you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Enchantment');
}

function tapTarget(ctx: ScriptCtx, obj: { targets: readonly { kind: string; id: string }[] }) {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id as InstanceId];
  if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
  return [{ t: 'PermanentsTapped' as const, cards: [target.id as InstanceId] }];
}

export const RIMEFUR_REINDEER_SCRIPT: CardScript = {
  oracleId: RIMEFUR_REINDEER.oracleId,
  name: RIMEFUR_REINDEER.name,
  triggers: [
    {
      abilityId: 'enchantment-etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Rimefur Reindeer — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => tapTarget(ctx, obj),
    },
    {
      abilityId: 'enchantment-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Rimefur Reindeer — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => tapTarget(ctx, obj),
    },
  ],
};
