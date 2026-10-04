// `Ratcatcher Trainee // Pest Problem` - a conditional static (as long as it's your turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RATCATCHER_TRAINEE_PEST_PROBLEM } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(RATCATCHER_TRAINEE_PEST_PROBLEM, "During your turn, this creature has first strike.\nCreate two 1/1 black Rat creature tokens with \"This token can't block.\" (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

// "as long as it's your turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.activePlayer === me;
}


export const RATCATCHER_TRAINEE_PEST_PROBLEM_SCRIPT: CardScript = {
  oracleId: RATCATCHER_TRAINEE_PEST_PROBLEM.oracleId,
  name: RATCATCHER_TRAINEE_PEST_PROBLEM.name,
  statics: [
    {
      abilityId: 'threshold-grant-0', face: 0,
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
