// `Gallant Pie-Wielder` - a conditional static (as long as two or more nonland permanents entered the battlefield under your control this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GALLANT_PIE_WIELDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GALLANT_PIE_WIELDER, "First strike\nCelebration — This creature has double strike as long as two or more nonland permanents entered the battlefield under your control this turn.");
const LINES = PRINTED.split('\n');

// "as long as two or more nonland permanents entered the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.turn.memory.entered[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (!face.typeLine.types.includes('Land'))) n++;
  }
  return n >= 2;
}


export const GALLANT_PIE_WIELDER_SCRIPT: CardScript = {
  oracleId: GALLANT_PIE_WIELDER.oracleId,
  name: GALLANT_PIE_WIELDER.name,
  statics: [
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};
