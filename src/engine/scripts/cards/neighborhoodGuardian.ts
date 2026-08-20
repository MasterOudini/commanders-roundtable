// `Neighborhood Guardian` — "Whenever another creature you control with
// power 2 or less enters, target creature you control gets +1/+1 until end
// of turn." Elemental Bond's power threshold turned around (at most 2),
// two defs, resolves inline twice (D178). D228.

import { NEIGHBORHOOD_GUARDIAN } from '../../../data/fixtures/engineCards';
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
  NEIGHBORHOOD_GUARDIAN,
  'Whenever another creature you control with power 2 or less enters, target creature you control gets +1/+1 until end of turn.',
);

function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  const d = ctx.derive(entrant);
  return d.typeLine.types.includes('Creature') && (d.power ?? 0) <= 2;
}

export const NEIGHBORHOOD_GUARDIAN_SCRIPT: CardScript = {
  oracleId: NEIGHBORHOOD_GUARDIAN.oracleId,
  name: NEIGHBORHOOD_GUARDIAN.name,
  triggers: [
    {
      abilityId: 'small-etb-card',
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
      label: () => 'Neighborhood Guardian — +1/+1 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }]
          : [];
      },
    },
    {
      abilityId: 'small-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Neighborhood Guardian — +1/+1 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }]
          : [];
      },
    },
  ],
};
