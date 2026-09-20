// `White Orchid Phantom` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHITE_ORCHID_PHANTOM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHITE_ORCHID_PHANTOM, "Flying, first strike\nWhen this creature enters, destroy up to one target nonbasic land. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy up to one target nonbasic land. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.", WHITE_ORCHID_PHANTOM.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy up to one target nonbasic land. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.");

export const WHITE_ORCHID_PHANTOM_SCRIPT: CardScript = {
  oracleId: WHITE_ORCHID_PHANTOM.oracleId,
  name: WHITE_ORCHID_PHANTOM.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "White Orchid Phantom - Destroy up to one target nonbasic land. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
