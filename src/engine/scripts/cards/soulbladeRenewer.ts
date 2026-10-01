// `Soulblade Renewer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOULBLADE_RENEWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOULBLADE_RENEWER, "Partner with Soulblade Corrupter (When this creature enters, target player may put Soulblade Corrupter into their hand from their library, then shuffle.)\nWhen this creature enters, support 2. (Put a +1/+1 counter on each of up to two other target creatures.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Support 2.", SOULBLADE_RENEWER.name);
const VOCAB_T_L1 = vocabularyTargets("Support 2.");

export const SOULBLADE_RENEWER_SCRIPT: CardScript = {
  oracleId: SOULBLADE_RENEWER.oracleId,
  name: SOULBLADE_RENEWER.name,
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
      label: () => "Soulblade Renewer - Support 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
