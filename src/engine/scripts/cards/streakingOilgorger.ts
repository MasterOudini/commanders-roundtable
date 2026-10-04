// `Streaking Oilgorger` - a conditional static (as long as you have max speed) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STREAKING_OILGORGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STREAKING_OILGORGER, "Flying, haste\nStart your engines! (If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.)\nMax speed — This creature has lifelink.");
const LINES = PRINTED.split('\n');

// "as long as you have max speed" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.speed ?? 0) >= 4;
}


export const STREAKING_OILGORGER_SCRIPT: CardScript = {
  oracleId: STREAKING_OILGORGER.oracleId,
  name: STREAKING_OILGORGER.name,
  statics: [
    {
      abilityId: 'threshold-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond2Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("lifelink");
      },
    },
  ],
};
