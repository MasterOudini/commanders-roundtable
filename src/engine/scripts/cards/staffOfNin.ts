// `Staff of Nin` — "At the beginning of your upkeep, draw a card.\n{T}: This
// artifact deals 1 damage to any target." Nyx-Fleece Ram's upkeep watcher
// with a draw, and a tap ping sourced from the Staff itself. D281.

import { STAFF_OF_NIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  STAFF_OF_NIN,
  'At the beginning of your upkeep, draw a card.\n{T}: This artifact deals 1 damage to any target.',
);
const UPKEEP = PRINTED.split('\n')[0] as string;
const PING = PRINTED.split('\n')[1] as string;

export const STAFF_OF_NIN_SCRIPT: CardScript = {
  oracleId: STAFF_OF_NIN.oracleId,
  name: STAFF_OF_NIN.name,
  triggers: [
    {
      abilityId: 'upkeep-draw',
      text: UPKEEP,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Staff of Nin — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
  activated: [
    {
      ref: `${STAFF_OF_NIN.oracleId}#a0`,
      text: PING,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
