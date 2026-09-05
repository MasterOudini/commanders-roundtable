// `Cantivore` - a static cdaCount
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CANTIVORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CANTIVORE, "Vigilance\nCantivore's power and toughness are each equal to the number of enchantment cards in all graveyards.");
const LINES = PRINTED.split('\n');

// "enchantment cards in all graveyards", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  const cards = Object.values(ctx.state.zones.graveyard).flat();
  let n = 0;
  for (const id of cards) {
    const inst = ctx.state.cards[id];
    if (!inst) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Enchantment')) continue;
    n++;
  }
  return n;
}


export const CANTIVORE_SCRIPT: CardScript = {
  oracleId: CANTIVORE.oracleId,
  name: CANTIVORE.name,
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
        chars.toughness = n;
      },
    },
  ],
};
