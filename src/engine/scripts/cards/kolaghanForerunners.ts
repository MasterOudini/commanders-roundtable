// `Kolaghan Forerunners` - a static cdaPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOLAGHAN_FORERUNNERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOLAGHAN_FORERUNNERS, "Trample\nKolaghan Forerunners's power is equal to the number of creatures you control.\nDash {2}{R} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

// "creatures you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
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


export const KOLAGHAN_FORERUNNERS_SCRIPT: CardScript = {
  oracleId: KOLAGHAN_FORERUNNERS.oracleId,
  name: KOLAGHAN_FORERUNNERS.name,
  statics: [
    {
      abilityId: 'cda-1',
      text: LINES[1] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        chars.power = n;
      },
    },
  ],
};
