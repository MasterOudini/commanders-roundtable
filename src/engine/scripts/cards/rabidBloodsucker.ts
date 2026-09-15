// `Rabid Bloodsucker` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RABID_BLOODSUCKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RABID_BLOODSUCKER, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhen this creature enters, each player loses 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player loses 2 life.", RABID_BLOODSUCKER.name);
const VOCAB_T_L1 = vocabularyTargets("Each player loses 2 life.");

export const RABID_BLOODSUCKER_SCRIPT: CardScript = {
  oracleId: RABID_BLOODSUCKER.oracleId,
  name: RABID_BLOODSUCKER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rabid Bloodsucker - Each player loses 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
