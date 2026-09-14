// `All That Glitters` - a static attachedPer
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALL_THAT_GLITTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALL_THAT_GLITTERS, "Enchant creature\nEnchanted creature gets +1/+1 for each artifact and/or enchantment you control.");
const LINES = PRINTED.split('\n');

// "artifact and/or enchantment you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!["Artifact","Enchantment"].some((t) => face.typeLine.types.includes(t))) continue;
    n++;
  }
  return n;
}


export const ALL_THAT_GLITTERS_SCRIPT: CardScript = {
  oracleId: ALL_THAT_GLITTERS.oracleId,
  name: ALL_THAT_GLITTERS.name,
  statics: [
    {
      abilityId: 'attached-per-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 1;
      },
    },
  ],
};
