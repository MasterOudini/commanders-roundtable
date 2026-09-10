// `Village Survivors` - a conditional static (as long as you have 5 or less life) anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VILLAGE_SURVIVORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VILLAGE_SURVIVORS, "Vigilance\nFateful hour — As long as you have 5 or less life, other creatures you control have vigilance.");
const LINES = PRINTED.split('\n');

// "as long as you have 5 or less life" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.life ?? 0) <= 5;
}


export const VILLAGE_SURVIVORS_SCRIPT: CardScript = {
  oracleId: VILLAGE_SURVIVORS.oracleId,
  name: VILLAGE_SURVIVORS.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
