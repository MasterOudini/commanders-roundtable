// `Deathmask Nezumi` - a conditional static (as long as you have seven or more cards in hand) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEATHMASK_NEZUMI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEATHMASK_NEZUMI, "As long as you have seven or more cards in hand, this creature gets +2/+1 and has fear. (It can't be blocked except by artifact creatures and/or black creatures.)");

// "as long as you have seven or more cards in hand" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.zones.hand[me] ?? []).length >= 7;
}


export const DEATHMASK_NEZUMI_SCRIPT: CardScript = {
  oracleId: DEATHMASK_NEZUMI.oracleId,
  name: DEATHMASK_NEZUMI.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("fear");
      },
    },
  ],
};
