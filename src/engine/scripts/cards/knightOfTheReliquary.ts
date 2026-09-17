// `Knight of the Reliquary` - a static pumpPer, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_THE_RELIQUARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_THE_RELIQUARY, "This creature gets +1/+1 for each land card in your graveyard.\n{T}, Sacrifice a Forest or Plains: Search your library for a land card, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a land card, put it onto the battlefield, then shuffle.", KNIGHT_OF_THE_RELIQUARY.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a land card, put it onto the battlefield, then shuffle.");

// "land card in your graveyard", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  const cards = ctx.state.zones.graveyard[me.controller] ?? [];
  let n = 0;
  for (const id of cards) {
    const inst = ctx.state.cards[id];
    if (!inst) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Land')) continue;
    n++;
  }
  return n;
}


export const KNIGHT_OF_THE_RELIQUARY_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_THE_RELIQUARY.oracleId,
  name: KNIGHT_OF_THE_RELIQUARY.name,
  activated: [
    {
      ref: `${KNIGHT_OF_THE_RELIQUARY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'pump-per-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 1;
      },
    },
  ],
};
