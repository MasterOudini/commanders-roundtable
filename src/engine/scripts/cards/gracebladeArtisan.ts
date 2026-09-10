// `Graceblade Artisan` - a VARIABLE PUMP (D387): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { GRACEBLADE_ARTISAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRACEBLADE_ARTISAN, "This creature gets +2/+2 for each Aura attached to it.");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.attachedTo !== applied) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!(face.typeLine.subtypes.includes("Aura"))) continue;
    n++;
  }
  return n;
}

export const GRACEBLADE_ARTISAN_SCRIPT: CardScript = {
  oracleId: GRACEBLADE_ARTISAN.oracleId,
  name: GRACEBLADE_ARTISAN.name,
  statics: [
    {
      abilityId: 'pump-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self, candidate) => {
        const n = countOf(ctx, self, candidate);
        if (chars.power !== null) chars.power += 2 * n;
        if (chars.toughness !== null) chars.toughness += 2 * n;
      },
    },
  ],
};
