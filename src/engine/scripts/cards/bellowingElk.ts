// `Bellowing Elk` - a conditional static (as long as you had another creature enter the battlefield under your control this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELLOWING_ELK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BELLOWING_ELK, "As long as you had another creature enter the battlefield under your control this turn, this creature has trample and indestructible.");

// "as long as you had another creature enter the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.turn.memory.entered[me] ?? []) {
    if (id === self) continue;
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (face.typeLine.types.includes('Creature'))) n++;
  }
  return n >= 1;
}


export const BELLOWING_ELK_SCRIPT: CardScript = {
  oracleId: BELLOWING_ELK.oracleId,
  name: BELLOWING_ELK.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("trample");
        chars.keywords.add("indestructible");
      },
    },
  ],
};
