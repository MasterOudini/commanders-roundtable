// `Divinity of Pride` - a conditional static (as long as you have 25 or more life) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIVINITY_OF_PRIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIVINITY_OF_PRIDE, "Flying, lifelink\nThis creature gets +4/+4 as long as you have 25 or more life.");
const LINES = PRINTED.split('\n');

// "as long as you have 25 or more life" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.life ?? 0) >= 25;
}


export const DIVINITY_OF_PRIDE_SCRIPT: CardScript = {
  oracleId: DIVINITY_OF_PRIDE.oracleId,
  name: DIVINITY_OF_PRIDE.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 4;
        if (chars.toughness !== null) chars.toughness += 4;
      },
    },
  ],
};
