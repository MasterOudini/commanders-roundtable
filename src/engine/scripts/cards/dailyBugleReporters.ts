// `Daily Bugle Reporters` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAILY_BUGLE_REPORTERS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(DAILY_BUGLE_REPORTERS, "When this creature enters, choose one —\n• Puff Piece — Put a +1/+1 counter on each of up to two target creatures.\n• Investigative Journalism — Return target creature card with mana value 2 or less from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Puff Piece — Put a +1/+1 counter on each of up to two target creatures.", targets: vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures.") },
  { text: "Investigative Journalism — Return target creature card with mana value 2 or less from your graveyard to your hand.", targets: vocabularyTargets("Return target creature card with mana value 2 or less from your graveyard to your hand.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Put a +1/+1 counter on each of up to two target creatures.", DAILY_BUGLE_REPORTERS.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures.");
const VOCAB_L0_m1 = vocabularyEffects("Return target creature card with mana value 2 or less from your graveyard to your hand.", DAILY_BUGLE_REPORTERS.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Return target creature card with mana value 2 or less from your graveyard to your hand.");

export const DAILY_BUGLE_REPORTERS_SCRIPT: CardScript = {
  oracleId: DAILY_BUGLE_REPORTERS.oracleId,
  name: DAILY_BUGLE_REPORTERS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Daily Bugle Reporters - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
