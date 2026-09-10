// `Sigil of the Nayan Gods` - a VARIABLE PUMP (D386): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { SIGIL_OF_THE_NAYAN_GODS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { InstanceId } from '../../types/ids';
import type { CardScript, ScriptCtx } from '../api';

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

const PRINTED = printed(SIGIL_OF_THE_NAYAN_GODS, "Enchant creature\nEnchanted creature gets +1/+1 for each creature you control.\nCycling {G/W} ({G/W}, Discard this card: Draw a card.)");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, _applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Creature")) continue;
    n++;
  }
  return n;
}

export const SIGIL_OF_THE_NAYAN_GODS_SCRIPT: CardScript = {
  oracleId: SIGIL_OF_THE_NAYAN_GODS.oracleId,
  name: SIGIL_OF_THE_NAYAN_GODS.name,
  statics: [
    {
      abilityId: 'pump-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, ctx, self, candidate) => {
        const n = countOf(ctx, self, candidate);
        if (chars.power !== null) chars.power += n;
        if (chars.toughness !== null) chars.toughness += n;
      },
    },
  ],
};
