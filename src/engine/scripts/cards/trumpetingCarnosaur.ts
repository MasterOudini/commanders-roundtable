// `Trumpeting Carnosaur` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUMPETING_CARNOSAUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRUMPETING_CARNOSAUR, "Trample\nWhen this creature enters, discover 5.\n{2}{R}, Discard this card: It deals 3 damage to target creature or planeswalker.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Discover 5.", TRUMPETING_CARNOSAUR.name);
const VOCAB_T_L1 = vocabularyTargets("Discover 5.");
const VOCAB_A0 = vocabularyEffects("It deals 3 damage to target creature or planeswalker.", TRUMPETING_CARNOSAUR.name);
const VOCAB_T_A0 = vocabularyTargets("It deals 3 damage to target creature or planeswalker.");

export const TRUMPETING_CARNOSAUR_SCRIPT: CardScript = {
  oracleId: TRUMPETING_CARNOSAUR.oracleId,
  name: TRUMPETING_CARNOSAUR.name,
  activated: [
    {
      ref: `${TRUMPETING_CARNOSAUR.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Trumpeting Carnosaur - Discover 5.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
