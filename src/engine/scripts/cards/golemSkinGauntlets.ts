// `Golem-Skin Gauntlets` - a VARIABLE PUMP (D387): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { GOLEM_SKIN_GAUNTLETS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLEM_SKIN_GAUNTLETS, "Equipped creature gets +1/+0 for each Equipment attached to it.\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.attachedTo !== applied) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!(face.typeLine.subtypes.includes("Equipment"))) continue;
    n++;
  }
  return n;
}

export const GOLEM_SKIN_GAUNTLETS_SCRIPT: CardScript = {
  oracleId: GOLEM_SKIN_GAUNTLETS.oracleId,
  name: GOLEM_SKIN_GAUNTLETS.name,
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
      },
    },
  ],
};
