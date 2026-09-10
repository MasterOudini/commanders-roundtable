// `Castle Raptors` - a conditional static (as long as this creature is untapped) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CASTLE_RAPTORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CASTLE_RAPTORS, "Flying\nAs long as this creature is untapped, it gets +0/+2.");
const LINES = PRINTED.split('\n');

// "as long as this creature is untapped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.tapped ?? false) === false;
}


export const CASTLE_RAPTORS_SCRIPT: CardScript = {
  oracleId: CASTLE_RAPTORS.oracleId,
  name: CASTLE_RAPTORS.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
