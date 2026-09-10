// `Yavimaya Enchantress` - a VARIABLE PUMP (D386): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { YAVIMAYA_ENCHANTRESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAVIMAYA_ENCHANTRESS, "This creature gets +1/+1 for each enchantment on the battlefield.");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, _applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Enchantment")) continue;
    n++;
  }
  return n;
}

export const YAVIMAYA_ENCHANTRESS_SCRIPT: CardScript = {
  oracleId: YAVIMAYA_ENCHANTRESS.oracleId,
  name: YAVIMAYA_ENCHANTRESS.name,
  statics: [
    {
      abilityId: 'pump-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self, candidate) => {
        const n = countOf(ctx, self, candidate);
        if (chars.power !== null) chars.power += n;
        if (chars.toughness !== null) chars.toughness += n;
      },
    },
  ],
};
