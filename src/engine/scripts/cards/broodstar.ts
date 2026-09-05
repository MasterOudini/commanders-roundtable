// `Broodstar` - a static cdaCount
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BROODSTAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BROODSTAR, "Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\nFlying\nBroodstar's power and toughness are each equal to the number of artifacts you control.");
const LINES = PRINTED.split('\n');

// "artifacts you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_2(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Artifact')) continue;
    n++;
  }
  return n;
}


export const BROODSTAR_SCRIPT: CardScript = {
  oracleId: BROODSTAR.oracleId,
  name: BROODSTAR.name,
  statics: [
    {
      abilityId: 'cda-2',
      text: LINES[2] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_2(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
