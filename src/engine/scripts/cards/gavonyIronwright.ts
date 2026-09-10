// `Gavony Ironwright` - a conditional static (as long as you have 5 or less life) anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GAVONY_IRONWRIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GAVONY_IRONWRIGHT, "Fateful hour — As long as you have 5 or less life, other creatures you control get +1/+4.");

// "as long as you have 5 or less life" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.life ?? 0) <= 5;
}


export const GAVONY_IRONWRIGHT_SCRIPT: CardScript = {
  oracleId: GAVONY_IRONWRIGHT.oracleId,
  name: GAVONY_IRONWRIGHT.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 4;
      },
    },
  ],
};
