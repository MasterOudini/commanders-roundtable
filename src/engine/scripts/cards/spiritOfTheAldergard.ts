// `Spirit of the Aldergard` - a etb trigger vocab, a static pumpPer
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIRIT_OF_THE_ALDERGARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIRIT_OF_THE_ALDERGARD, "When this creature enters, search your library for a snow land card, reveal it, put it into your hand, then shuffle.\nThis creature gets +1/+0 for each other snow permanent you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a snow land card, reveal it, put it into your hand, then shuffle.", SPIRIT_OF_THE_ALDERGARD.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a snow land card, reveal it, put it into your hand, then shuffle.");

// "other snow permanent you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.supertypes.includes('Snow')) continue;
    n++;
  }
  return n;
}


export const SPIRIT_OF_THE_ALDERGARD_SCRIPT: CardScript = {
  oracleId: SPIRIT_OF_THE_ALDERGARD.oracleId,
  name: SPIRIT_OF_THE_ALDERGARD.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Spirit of the Aldergard - Search your library for a snow land card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
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
        if (chars.toughness !== null) chars.toughness += n * 0;
      },
    },
  ],
};
