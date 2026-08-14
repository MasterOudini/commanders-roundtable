// `Keeper of Fables` — "Whenever one or more non-Human creatures you
// control deal combat damage to a player, draw a card." The per-event
// batching of `CombatDamageDealt` IS the card's "one or more" wording
// (Deeproot Pilgrimage's argument, D170), and the filter asks the DERIVED
// dealer: mine, a Creature, and not a Human. M6.4aa, D183.

import { KEEPER_OF_FABLES } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  KEEPER_OF_FABLES,
  'Whenever one or more non-Human creatures you control deal combat damage to a player, draw a card.',
);

export const KEEPER_OF_FABLES_SCRIPT: CardScript = {
  oracleId: KEEPER_OF_FABLES.oracleId,
  name: KEEPER_OF_FABLES.name,
  triggers: [
    {
      abilityId: 'hit-player',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => {
          if (d.target.kind !== 'player' || d.amount <= 0) return false;
          const inst = ctx.state.cards[d.source];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          const derived = ctx.derive(d.source);
          return (
            derived.typeLine.types.includes('Creature') &&
            !derived.typeLine.subtypes.includes('Human')
          );
        }),
      label: () => 'Keeper of Fables — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
