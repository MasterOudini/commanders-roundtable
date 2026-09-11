// `Reclusive Taxidermist` - a conditional static (as long as there are four or more creature cards in your graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RECLUSIVE_TAXIDERMIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RECLUSIVE_TAXIDERMIST, "This creature gets +3/+2 as long as there are four or more creature cards in your graveyard.\n{T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

// "as long as there are four or more creature cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (face.typeLine.types.includes("Creature"))) n++;
  }
  return n >= 4;
}


export const RECLUSIVE_TAXIDERMIST_SCRIPT: CardScript = {
  oracleId: RECLUSIVE_TAXIDERMIST.oracleId,
  name: RECLUSIVE_TAXIDERMIST.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
