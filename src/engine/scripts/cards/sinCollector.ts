// `Sin Collector` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIN_COLLECTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIN_COLLECTOR, "When this creature enters, target opponent reveals their hand. You choose an instant or sorcery card from it and exile that card.");

const VOCAB_L0 = vocabularyEffects("Target opponent reveals their hand. You choose an instant or sorcery card from it and exile that card.", SIN_COLLECTOR.name);
const VOCAB_T_L0 = vocabularyTargets("Target opponent reveals their hand. You choose an instant or sorcery card from it and exile that card.");

export const SIN_COLLECTOR_SCRIPT: CardScript = {
  oracleId: SIN_COLLECTOR.oracleId,
  name: SIN_COLLECTOR.name,
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
      label: () => "Sin Collector - Target opponent reveals their hand. You choose an instant or sorcery card from it and exile that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
