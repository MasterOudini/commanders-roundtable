// `Staunch Crewmate` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAUNCH_CREWMATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAUNCH_CREWMATE, "When this creature enters, look at the top four cards of your library. You may reveal an artifact or Pirate card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

const VOCAB_L0 = vocabularyEffects("Look at the top four cards of your library. You may reveal an artifact or Pirate card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", STAUNCH_CREWMATE.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top four cards of your library. You may reveal an artifact or Pirate card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

export const STAUNCH_CREWMATE_SCRIPT: CardScript = {
  oracleId: STAUNCH_CREWMATE.oracleId,
  name: STAUNCH_CREWMATE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Staunch Crewmate - Look at the top four cards of your library. You may reveal an artifact or Pirate card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
