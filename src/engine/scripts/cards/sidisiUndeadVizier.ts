// `Sidisi, Undead Vizier` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIDISI_UNDEAD_VIZIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIDISI_UNDEAD_VIZIER, "Deathtouch\nExploit (When this creature enters, you may sacrifice a creature.)\nWhen Sidisi exploits a creature, you may search your library for a card, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Search your library for a card, put it into your hand, then shuffle.", SIDISI_UNDEAD_VIZIER.name);
const VOCAB_T_L2 = vocabularyTargets("Search your library for a card, put it into your hand, then shuffle.");

export const SIDISI_UNDEAD_VIZIER_SCRIPT: CardScript = {
  oracleId: SIDISI_UNDEAD_VIZIER.oracleId,
  name: SIDISI_UNDEAD_VIZIER.name,
  triggers: [
    {
      abilityId: 'exploits-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Sidisi, Undead Vizier - Search your library for a card, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
