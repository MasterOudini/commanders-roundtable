// `Rakdos Firewheeler` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAKDOS_FIREWHEELER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAKDOS_FIREWHEELER, "When this creature enters, it deals 2 damage to target opponent and 2 damage to up to one target creature or planeswalker.");

const VOCAB_L0 = vocabularyEffects("~ deals 2 damage to target opponent and 2 damage to up to one target creature or planeswalker.", RAKDOS_FIREWHEELER.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 2 damage to target opponent and 2 damage to up to one target creature or planeswalker.");

export const RAKDOS_FIREWHEELER_SCRIPT: CardScript = {
  oracleId: RAKDOS_FIREWHEELER.oracleId,
  name: RAKDOS_FIREWHEELER.name,
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
      label: () => "Rakdos Firewheeler - ~ deals 2 damage to target opponent and 2 damage to up to one target creature or planeswalker.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
