// `Vault Plunderer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VAULT_PLUNDERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAULT_PLUNDERER, "When this creature enters, target player draws a card and loses 1 life.");

const VOCAB_L0 = vocabularyEffects("Target player draws a card and loses 1 life.", VAULT_PLUNDERER.name);
const VOCAB_T_L0 = vocabularyTargets("Target player draws a card and loses 1 life.");

export const VAULT_PLUNDERER_SCRIPT: CardScript = {
  oracleId: VAULT_PLUNDERER.oracleId,
  name: VAULT_PLUNDERER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Vault Plunderer - Target player draws a card and loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
