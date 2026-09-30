// `Melded Moxite` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MELDED_MOXITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MELDED_MOXITE, "When this artifact enters, you may discard a card. If you do, draw two cards.\n{3}, Sacrifice this artifact: Create a tapped 2/2 colorless Robot artifact creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may discard a card. If you do, draw two cards.", MELDED_MOXITE.name);
const VOCAB_T_L0 = vocabularyTargets("You may discard a card. If you do, draw two cards.");
const VOCAB_A0 = vocabularyEffects("Create a tapped 2/2 colorless Robot artifact creature token.", MELDED_MOXITE.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 2/2 colorless Robot artifact creature token.");

export const MELDED_MOXITE_SCRIPT: CardScript = {
  oracleId: MELDED_MOXITE.oracleId,
  name: MELDED_MOXITE.name,
  activated: [
    {
      ref: `${MELDED_MOXITE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Melded Moxite - You may discard a card. If you do, draw two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
