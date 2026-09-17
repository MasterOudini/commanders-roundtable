// `Horizon Spellbomb` - an activation vocab, a auraToGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORIZON_SPELLBOMB } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(HORIZON_SPELLBOMB, "{2}, {T}, Sacrifice this artifact: Search your library for a basic land card, reveal it, put it into your hand, then shuffle.\nWhen this artifact is put into a graveyard from the battlefield, you may pay {G}. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.", HORIZON_SPELLBOMB.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.");
const VOCAB_L1 = vocabularyEffects("You may pay {G}. If you do, draw a card.", HORIZON_SPELLBOMB.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {G}. If you do, draw a card.");

export const HORIZON_SPELLBOMB_SCRIPT: CardScript = {
  oracleId: HORIZON_SPELLBOMB.oracleId,
  name: HORIZON_SPELLBOMB.name,
  activated: [
    {
      ref: `${HORIZON_SPELLBOMB.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Horizon Spellbomb - You may pay {G}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
