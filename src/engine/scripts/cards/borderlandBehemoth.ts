// `Borderland Behemoth` - a static pumpPer
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BORDERLAND_BEHEMOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BORDERLAND_BEHEMOTH, "Trample\nThis creature gets +4/+4 for each other Giant you control.");
const LINES = PRINTED.split('\n');

// "other Giant you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes('Giant')) continue;
    n++;
  }
  return n;
}


export const BORDERLAND_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: BORDERLAND_BEHEMOTH.oracleId,
  name: BORDERLAND_BEHEMOTH.name,
  statics: [
    {
      abilityId: 'pump-per-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        if (chars.power !== null) chars.power += n * 4;
        if (chars.toughness !== null) chars.toughness += n * 4;
      },
    },
  ],
};
