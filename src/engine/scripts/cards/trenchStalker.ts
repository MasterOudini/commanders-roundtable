// `Trench Stalker` - a conditional static (as long as you've drawn two or more cards this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRENCH_STALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRENCH_STALKER, "As long as you've drawn two or more cards this turn, this creature has deathtouch and lifelink.");

// "as long as you've drawn two or more cards this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.cardsDrawn[me] ?? 0) >= 2;
}


export const TRENCH_STALKER_SCRIPT: CardScript = {
  oracleId: TRENCH_STALKER.oracleId,
  name: TRENCH_STALKER.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("deathtouch");
        chars.keywords.add("lifelink");
      },
    },
  ],
};
