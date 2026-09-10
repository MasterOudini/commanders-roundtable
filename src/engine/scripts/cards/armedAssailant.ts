// `Armed Assailant` - a conditional static (as long as this creature is equipped) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARMED_ASSAILANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARMED_ASSAILANT, "Deathtouch\nAs long as this creature is equipped, it gets +2/+0 and has menace. (It can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

// "as long as this creature is equipped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.attachedTo !== self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (face && face.typeLine.subtypes.includes("Equipment")) return true;
  }
  return false;
}


export const ARMED_ASSAILANT_SCRIPT: CardScript = {
  oracleId: ARMED_ASSAILANT.oracleId,
  name: ARMED_ASSAILANT.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
