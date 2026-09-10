// `Grand Ball Guest` - a conditional static (as long as two or more nonland permanents entered the battlefield under your control this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAND_BALL_GUEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAND_BALL_GUEST, "Celebration — This creature gets +1/+1 and has trample as long as two or more nonland permanents entered the battlefield under your control this turn.");

// "as long as two or more nonland permanents entered the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
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


export const GRAND_BALL_GUEST_SCRIPT: CardScript = {
  oracleId: GRAND_BALL_GUEST.oracleId,
  name: GRAND_BALL_GUEST.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
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
        chars.keywords.add("trample");
      },
    },
  ],
};
