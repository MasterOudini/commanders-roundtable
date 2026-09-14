// `Nimana Skydancer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIMANA_SKYDANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIMANA_SKYDANCER, "Flash\nFlying\nWhen this creature enters, target opponent mills two cards. (They put the top two cards of their library into their graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target opponent mills two cards.", NIMANA_SKYDANCER.name);
const VOCAB_T_L2 = vocabularyTargets("Target opponent mills two cards.");

export const NIMANA_SKYDANCER_SCRIPT: CardScript = {
  oracleId: NIMANA_SKYDANCER.oracleId,
  name: NIMANA_SKYDANCER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Nimana Skydancer - Target opponent mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
