// `Lightning Helix` — 3 anywhere, 3 back to me. D222.

import { LIGHTNING_HELIX } from '../../../data/fixtures/engineCards';
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
  LIGHTNING_HELIX,
  'Lightning Helix deals 3 damage to any target and you gain 3 life.',
);

export const LIGHTNING_HELIX_SCRIPT: CardScript = {
  oracleId: LIGHTNING_HELIX.oracleId,
  name: LIGHTNING_HELIX.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      const events: EventBody[] = [];
      if (target && target.kind !== 'stack') {
        const legal =
          target.kind === 'player'
            ? !ctx.state.players[target.id]?.hasLost
            : ctx.state.cards[target.id]?.zone.kind === 'battlefield';
        if (legal) {
          events.push({
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
                amount: 3,
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
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 });
      }
      return events;
    },
  },
};
