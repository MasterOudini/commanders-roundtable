// `Deepwater Hypnotist` - a becomesUntapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEPWATER_HYPNOTIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEPWATER_HYPNOTIST, "Inspired — Whenever this creature becomes untapped, target creature an opponent controls gets -3/-0 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature an opponent controls gets -3/-0 until end of turn.", DEEPWATER_HYPNOTIST.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature an opponent controls gets -3/-0 until end of turn.");

export const DEEPWATER_HYPNOTIST_SCRIPT: CardScript = {
  oracleId: DEEPWATER_HYPNOTIST.oracleId,
  name: DEEPWATER_HYPNOTIST.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: PRINTED,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Deepwater Hypnotist - Target creature an opponent controls gets -3/-0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
