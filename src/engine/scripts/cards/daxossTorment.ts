// `Daxos's Torment` - a constellation trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAXOS_S_TORMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAXOS_S_TORMENT, "Constellation — Whenever this enchantment or another enchantment you control enters, this enchantment becomes a 5/5 Demon creature with flying and haste in addition to its other types until end of turn.");

const VOCAB_L0 = vocabularyEffects("This enchantment becomes a 5/5 Demon creature with flying and haste in addition to its other types until end of turn.", DAXOS_S_TORMENT.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment becomes a 5/5 Demon creature with flying and haste in addition to its other types until end of turn.");

export const DAXOSS_TORMENT_SCRIPT: CardScript = {
  oracleId: DAXOS_S_TORMENT.oracleId,
  name: DAXOS_S_TORMENT.name,
  triggers: [
    {
      abilityId: 'constellation-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Enchantment')),
        ),
      label: () => "Daxos's Torment - This enchantment becomes a 5/5 Demon creature with flying and haste in addition to its other types until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
