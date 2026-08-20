// `Inspired Ultimatum` — gains for the first target, 5 at the second,
// five cards for me: three riders, two arrows, one resolve. D220.

import { INSPIRED_ULTIMATUM } from '../../../data/fixtures/engineCards';
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
  INSPIRED_ULTIMATUM,
  'Target player gains 5 life, Inspired Ultimatum deals 5 damage to any target, then you draw five cards.',
);

export const INSPIRED_ULTIMATUM_SCRIPT: CardScript = {
  oracleId: INSPIRED_ULTIMATUM.oracleId,
  name: INSPIRED_ULTIMATUM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const gainer = obj.targets[0];
      if (gainer && gainer.kind === 'player') {
        const p = ctx.state.players[gainer.id];
        if (p && !p.hasLost) {
          events.push({ t: 'LifeChanged', player: gainer.id, delta: 5, to: p.life + 5 });
        }
      }
      const burned = obj.targets[1];
      if (burned && burned.kind !== 'stack') {
        const legal =
          burned.kind === 'player'
            ? !ctx.state.players[burned.id]?.hasLost
            : ctx.state.cards[burned.id]?.zone.kind === 'battlefield';
        if (legal) {
          events.push({
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  burned.kind === 'player'
                    ? { kind: 'player', id: burned.id }
                    : { kind: 'card', id: burned.id },
                amount: 5,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          });
        }
      }
      events.push(...drawEvents(ctx.state, obj.controller, 5));
      return events;
    },
  },
};
