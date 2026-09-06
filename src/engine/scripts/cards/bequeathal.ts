// `Bequeathal` - a enchantedCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEQUEATHAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BEQUEATHAL, "Enchant creature\nWhen enchanted creature dies, you draw two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You draw two cards.", BEQUEATHAL.name);
const VOCAB_T_L1 = vocabularyTargets("You draw two cards.");

export const BEQUEATHAL_SCRIPT: CardScript = {
  oracleId: BEQUEATHAL.oracleId,
  name: BEQUEATHAL.name,
  triggers: [
    {
      abilityId: 'enchantedCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === ctx.state.cards[self]?.attachedTo && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Bequeathal - You draw two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
