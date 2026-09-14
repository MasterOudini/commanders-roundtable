// `Conclave's Blessing` - a static attachedPer
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONCLAVE_S_BLESSING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONCLAVE_S_BLESSING, "Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.)\nEnchant creature\nEnchanted creature gets +0/+2 for each other creature you control.");
const LINES = PRINTED.split('\n');

// "other creature you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_2(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Creature')) continue;
    n++;
  }
  return n;
}


export const CONCLAVES_BLESSING_SCRIPT: CardScript = {
  oracleId: CONCLAVE_S_BLESSING.oracleId,
  name: CONCLAVE_S_BLESSING.name,
  statics: [
    {
      abilityId: 'attached-per-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, ctx, self) => {
        const n = countOf_2(ctx, self);
        if (chars.power !== null) chars.power += n * 0;
        if (chars.toughness !== null) chars.toughness += n * 2;
      },
    },
  ],
};
