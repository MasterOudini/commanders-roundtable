// `Gnarled Sage` - a conditional static (as long as you've drawn two or more cards this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GNARLED_SAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GNARLED_SAGE, "Reach (This creature can block creatures with flying.)\nAs long as you've drawn two or more cards this turn, this creature gets +0/+2 and has vigilance. (Attacking doesn't cause it to tap.)");
const LINES = PRINTED.split('\n');

// "as long as you've drawn two or more cards this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.cardsDrawn[me] ?? 0) >= 2;
}


export const GNARLED_SAGE_SCRIPT: CardScript = {
  oracleId: GNARLED_SAGE.oracleId,
  name: GNARLED_SAGE.name,
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
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
