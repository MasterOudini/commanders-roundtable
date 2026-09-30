// `Cranial Plating` - a static attachedPer, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRANIAL_PLATING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRANIAL_PLATING, "Equipped creature gets +1/+0 for each artifact you control.\n{B}{B}: Attach this Equipment to target creature you control.\nEquip {1}");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Attach this Equipment to target creature you control.", CRANIAL_PLATING.name);
const VOCAB_T_A0 = vocabularyTargets("Attach this Equipment to target creature you control.");

// "artifact you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.phasedOut) continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Artifact')) continue;
    n++;
  }
  return n;
}


export const CRANIAL_PLATING_SCRIPT: CardScript = {
  oracleId: CRANIAL_PLATING.oracleId,
  name: CRANIAL_PLATING.name,
  activated: [
    {
      ref: `${CRANIAL_PLATING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-per-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 0;
      },
    },
  ],
};
