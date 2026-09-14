// `Kambal, Consul of Allocation` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAMBAL_CONSUL_OF_ALLOCATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAMBAL_CONSUL_OF_ALLOCATION, "Whenever an opponent casts a noncreature spell, that player loses 2 life and you gain 2 life.");

const VOCAB_L0 = vocabularyEffects("Target player loses 2 life and you gain 2 life.", KAMBAL_CONSUL_OF_ALLOCATION.name);
const VOCAB_T_L0 = vocabularyTargets("Target player loses 2 life and you gain 2 life.");

export const KAMBAL_CONSUL_OF_ALLOCATION_SCRIPT: CardScript = {
  oracleId: KAMBAL_CONSUL_OF_ALLOCATION.oracleId,
  name: KAMBAL_CONSUL_OF_ALLOCATION.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, _self, ev) => (ev.t === 'SpellCast' ? ev.obj.controller : null),
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Kambal, Consul of Allocation - Target player loses 2 life and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
