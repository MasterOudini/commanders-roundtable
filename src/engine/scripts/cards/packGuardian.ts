// `Pack Guardian` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PACK_GUARDIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PACK_GUARDIAN, "Flash\nWhen this creature enters, you may discard a land card. If you do, create a 2/2 green Wolf creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may discard a land card. If you do, create a 2/2 green Wolf creature token.", PACK_GUARDIAN.name);
const VOCAB_T_L1 = vocabularyTargets("You may discard a land card. If you do, create a 2/2 green Wolf creature token.");

export const PACK_GUARDIAN_SCRIPT: CardScript = {
  oracleId: PACK_GUARDIAN.oracleId,
  name: PACK_GUARDIAN.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Pack Guardian - You may discard a land card. If you do, create a 2/2 green Wolf creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
