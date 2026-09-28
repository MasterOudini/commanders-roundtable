// `Migratory Greathorn` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIGRATORY_GREATHORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIGRATORY_GREATHORN, "Mutate {2}{G} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nWhenever this creature mutates, search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", MIGRATORY_GREATHORN.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");

export const MIGRATORY_GREATHORN_SCRIPT: CardScript = {
  oracleId: MIGRATORY_GREATHORN.oracleId,
  name: MIGRATORY_GREATHORN.name,
  triggers: [
    {
      abilityId: 'mutates-1',
      text: LINES[1] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Migratory Greathorn - Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
