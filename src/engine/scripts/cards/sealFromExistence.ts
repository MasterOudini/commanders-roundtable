// `Seal from Existence` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEAL_FROM_EXISTENCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEAL_FROM_EXISTENCE, "Ward {3} (Whenever this enchantment becomes the target of a spell or ability an opponent controls, counter it unless that player pays {3}.)\nWhen this enchantment enters, exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.", SEAL_FROM_EXISTENCE.name);
const VOCAB_T_L1 = vocabularyTargets("Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.");

export const SEAL_FROM_EXISTENCE_SCRIPT: CardScript = {
  oracleId: SEAL_FROM_EXISTENCE.oracleId,
  name: SEAL_FROM_EXISTENCE.name,
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
      label: () => "Seal from Existence - Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
