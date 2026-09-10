// `Drover of the Mighty` - a conditional static (as long as you control a Dinosaur) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DROVER_OF_THE_MIGHTY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DROVER_OF_THE_MIGHTY, "This creature gets +2/+2 as long as you control a Dinosaur.\n{T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

// "as long as you control a Dinosaur" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes("Dinosaur")) continue;
    n++;
  }
  return n >= 1;
}


export const DROVER_OF_THE_MIGHTY_SCRIPT: CardScript = {
  oracleId: DROVER_OF_THE_MIGHTY.oracleId,
  name: DROVER_OF_THE_MIGHTY.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
