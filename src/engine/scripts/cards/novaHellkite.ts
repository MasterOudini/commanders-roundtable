// `Nova Hellkite` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NOVA_HELLKITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NOVA_HELLKITE, "Flying, haste\nWhen this creature enters, it deals 1 damage to target creature an opponent controls.\nWarp {2}{R} (You may cast this card from your hand for its warp cost. Exile this creature at the beginning of the next end step, then you may cast it from exile on a later turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to target creature an opponent controls.", NOVA_HELLKITE.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to target creature an opponent controls.");

export const NOVA_HELLKITE_SCRIPT: CardScript = {
  oracleId: NOVA_HELLKITE.oracleId,
  name: NOVA_HELLKITE.name,
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
      label: () => "Nova Hellkite - ~ deals 1 damage to target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
