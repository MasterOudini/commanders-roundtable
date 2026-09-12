// `Lifebane Zombie` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIFEBANE_ZOMBIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIFEBANE_ZOMBIE, "Intimidate (This creature can't be blocked except by artifact creatures and/or creatures that share a color with it.)\nWhen this creature enters, target opponent reveals their hand. You choose a green or white creature card from it and exile that card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent reveals their hand. You choose a green or white creature card from it and exile that card.", LIFEBANE_ZOMBIE.name);
const VOCAB_T_L1 = vocabularyTargets("Target opponent reveals their hand. You choose a green or white creature card from it and exile that card.");

export const LIFEBANE_ZOMBIE_SCRIPT: CardScript = {
  oracleId: LIFEBANE_ZOMBIE.oracleId,
  name: LIFEBANE_ZOMBIE.name,
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
      label: () => "Lifebane Zombie - Target opponent reveals their hand. You choose a green or white creature card from it and exile that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
