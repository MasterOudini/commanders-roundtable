// `Giant Tortoise` - a conditional static (as long as it's untapped) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIANT_TORTOISE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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

const PRINTED = printed(GIANT_TORTOISE, "This creature gets +0/+3 as long as it's untapped.");

// "as long as it's untapped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.tapped ?? false) === false;
}


export const GIANT_TORTOISE_SCRIPT: CardScript = {
  oracleId: GIANT_TORTOISE.oracleId,
  name: GIANT_TORTOISE.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
  ],
};
