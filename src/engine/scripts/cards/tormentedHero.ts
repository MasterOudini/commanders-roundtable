// `Tormented Hero` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TORMENTED_HERO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TORMENTED_HERO, "This creature enters tapped.\nHeroic — Whenever you cast a spell that targets this creature, each opponent loses 1 life. You gain life equal to the life lost this way.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent loses 1 life. You gain life equal to the life lost this way.", TORMENTED_HERO.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent loses 1 life. You gain life equal to the life lost this way.");

export const TORMENTED_HERO_SCRIPT: CardScript = {
  oracleId: TORMENTED_HERO.oracleId,
  name: TORMENTED_HERO.name,
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tormented Hero - Each opponent loses 1 life. You gain life equal to the life lost this way.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
