// `Harvestguard Alseids` - a constellation trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARVESTGUARD_ALSEIDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARVESTGUARD_ALSEIDS, "Constellation — Whenever this creature or another enchantment you control enters, prevent all damage that would be dealt to target creature this turn.");

const VOCAB_L0 = vocabularyEffects("Prevent all damage that would be dealt to target creature this turn.", HARVESTGUARD_ALSEIDS.name);
const VOCAB_T_L0 = vocabularyTargets("Prevent all damage that would be dealt to target creature this turn.");

export const HARVESTGUARD_ALSEIDS_SCRIPT: CardScript = {
  oracleId: HARVESTGUARD_ALSEIDS.oracleId,
  name: HARVESTGUARD_ALSEIDS.name,
  triggers: [
    {
      abilityId: 'constellation-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Enchantment')),
        ),
      label: () => "Harvestguard Alseids - Prevent all damage that would be dealt to target creature this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
