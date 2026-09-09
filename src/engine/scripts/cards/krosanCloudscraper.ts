// `Krosan Cloudscraper` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROSAN_CLOUDSCRAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_CLOUDSCRAPER, "At the beginning of your upkeep, sacrifice this creature unless you pay {G}{G}.\nMorph {7}{G}{G} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Sacrifice this creature unless you pay {G}{G}.", KROSAN_CLOUDSCRAPER.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice this creature unless you pay {G}{G}.");

export const KROSAN_CLOUDSCRAPER_SCRIPT: CardScript = {
  oracleId: KROSAN_CLOUDSCRAPER.oracleId,
  name: KROSAN_CLOUDSCRAPER.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Krosan Cloudscraper - Sacrifice this creature unless you pay {G}{G}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
