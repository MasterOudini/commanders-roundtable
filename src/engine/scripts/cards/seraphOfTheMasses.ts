// `Seraph of the Masses` - a static cdaCount
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERAPH_OF_THE_MASSES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERAPH_OF_THE_MASSES, "Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.)\nFlying\nSeraph of the Masses's power and toughness are each equal to the number of creatures you control.");
const LINES = PRINTED.split('\n');

// "creatures you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_2(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Creature')) continue;
    n++;
  }
  return n;
}


export const SERAPH_OF_THE_MASSES_SCRIPT: CardScript = {
  oracleId: SERAPH_OF_THE_MASSES.oracleId,
  name: SERAPH_OF_THE_MASSES.name,
  statics: [
    {
      abilityId: 'cda-2',
      text: LINES[2] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_2(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
