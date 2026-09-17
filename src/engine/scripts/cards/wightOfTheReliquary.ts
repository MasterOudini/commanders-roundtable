// `Wight of the Reliquary` - a static pumpPer, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WIGHT_OF_THE_RELIQUARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WIGHT_OF_THE_RELIQUARY, "Vigilance\nThis creature gets +1/+1 for each creature card in your graveyard.\n{T}, Sacrifice another creature: Search your library for a land card, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a land card, put it onto the battlefield tapped, then shuffle.", WIGHT_OF_THE_RELIQUARY.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a land card, put it onto the battlefield tapped, then shuffle.");

// "creature card in your graveyard", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  const cards = ctx.state.zones.graveyard[me.controller] ?? [];
  let n = 0;
  for (const id of cards) {
    const inst = ctx.state.cards[id];
    if (!inst) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Creature')) continue;
    n++;
  }
  return n;
}


export const WIGHT_OF_THE_RELIQUARY_SCRIPT: CardScript = {
  oracleId: WIGHT_OF_THE_RELIQUARY.oracleId,
  name: WIGHT_OF_THE_RELIQUARY.name,
  activated: [
    {
      ref: `${WIGHT_OF_THE_RELIQUARY.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'pump-per-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 1;
      },
    },
  ],
};
