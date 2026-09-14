// `Jagged-Scar Archers` - a static cdaCount, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JAGGED_SCAR_ARCHERS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
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

const PRINTED = printed(JAGGED_SCAR_ARCHERS, "Jagged-Scar Archers's power and toughness are each equal to the number of Elves you control.\n{T}: This creature deals damage equal to its power to target creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to its power to target creature with flying.", JAGGED_SCAR_ARCHERS.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to its power to target creature with flying.");

// "Elves you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes('Elf')) continue;
    n++;
  }
  return n;
}


export const JAGGED_SCAR_ARCHERS_SCRIPT: CardScript = {
  oracleId: JAGGED_SCAR_ARCHERS.oracleId,
  name: JAGGED_SCAR_ARCHERS.name,
  activated: [
    {
      ref: `${JAGGED_SCAR_ARCHERS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-0',
      text: LINES[0] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
