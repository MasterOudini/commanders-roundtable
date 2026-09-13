// `Lightning Rift` - a aPlayerCycles trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIGHTNING_RIFT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIGHTNING_RIFT, "Whenever a player cycles a card, you may pay {1}. If you do, this enchantment deals 2 damage to any target.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, this enchantment deals 2 damage to any target.", LIGHTNING_RIFT.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, this enchantment deals 2 damage to any target.");

export const LIGHTNING_RIFT_SCRIPT: CardScript = {
  oracleId: LIGHTNING_RIFT.oracleId,
  name: LIGHTNING_RIFT.name,
  triggers: [
    {
      abilityId: 'aPlayerCycles-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand',
        ),
      label: () => "Lightning Rift - You may pay {1}. If you do, this enchantment deals 2 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
