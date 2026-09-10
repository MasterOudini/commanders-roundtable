// `Manaforce Mace` - a VARIABLE PUMP (D387): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { MANAFORCE_MACE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANAFORCE_MACE, "Domain — Equipped creature gets +1/+1 for each basic land type among lands you control.\nEquip {3}");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, _applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  const types = new Set<string>();
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    for (const t of ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']) if (face.typeLine.subtypes.includes(t)) types.add(t);
  }
  n = types.size;
  return n;
}

export const MANAFORCE_MACE_SCRIPT: CardScript = {
  oracleId: MANAFORCE_MACE.oracleId,
  name: MANAFORCE_MACE.name,
  statics: [
    {
      abilityId: 'pump-0',
      text: LINES[0] as string,
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
