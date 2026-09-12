// `Benthic Criminologists` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BENTHIC_CRIMINOLOGISTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BENTHIC_CRIMINOLOGISTS, "Whenever this creature enters or attacks, you may sacrifice an artifact. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice an artifact. If you do, draw a card.", BENTHIC_CRIMINOLOGISTS.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice an artifact. If you do, draw a card.");

export const BENTHIC_CRIMINOLOGISTS_SCRIPT: CardScript = {
  oracleId: BENTHIC_CRIMINOLOGISTS.oracleId,
  name: BENTHIC_CRIMINOLOGISTS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Benthic Criminologists - You may sacrifice an artifact. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Benthic Criminologists - You may sacrifice an artifact. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
