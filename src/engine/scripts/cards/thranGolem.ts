// `Thran Golem` - a conditional static (as long as this creature is enchanted) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRAN_GOLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THRAN_GOLEM, "As long as this creature is enchanted, it gets +2/+2 and has flying, first strike, and trample.");

// "as long as this creature is enchanted" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.attachedTo !== self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (face && face.typeLine.subtypes.includes("Aura")) return true;
  }
  return false;
}


export const THRAN_GOLEM_SCRIPT: CardScript = {
  oracleId: THRAN_GOLEM.oracleId,
  name: THRAN_GOLEM.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("flying");
        chars.keywords.add("firstStrike");
        chars.keywords.add("trample");
      },
    },
  ],
};
