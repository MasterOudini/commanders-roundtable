// `Freestrider Lookout` - a youCommitCrime trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FREESTRIDER_LOOKOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FREESTRIDER_LOOKOUT, "Reach\nWhenever you commit a crime, look at the top five cards of your library. You may put a land card from among them onto the battlefield tapped. Put the rest on the bottom of your library in a random order. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top five cards of your library. You may put a land card from among them onto the battlefield tapped. Put the rest on the bottom of your library in a random order.", FREESTRIDER_LOOKOUT.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top five cards of your library. You may put a land card from among them onto the battlefield tapped. Put the rest on the bottom of your library in a random order.");

export const FREESTRIDER_LOOKOUT_SCRIPT: CardScript = {
  oracleId: FREESTRIDER_LOOKOUT.oracleId,
  name: FREESTRIDER_LOOKOUT.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-1',
      text: LINES[1] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Freestrider Lookout - Look at the top five cards of your library. You may put a land card from among them onto the battlefield tapped. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
