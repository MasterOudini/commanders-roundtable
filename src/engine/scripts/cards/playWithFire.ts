// `Play with Fire` — "Play with Fire deals 2 damage to any target. If a
// player is dealt damage this way, scry 1." The burn with a conditional
// ask, and the ask comes LAST (D195's rule) — which the sentence order
// already is. D234.

import { PLAY_WITH_FIRE } from '../../../data/fixtures/engineCards';
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
  PLAY_WITH_FIRE,
  'Play with Fire deals 2 damage to any target. If a player is dealt damage this way, scry 1. ' +
    '(Look at the top card of your library. You may put that card on the bottom.)',
);

export const PLAY_WITH_FIRE_SCRIPT: CardScript = {
  oracleId: PLAY_WITH_FIRE.oracleId,
  name: PLAY_WITH_FIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      const events: EventBody[] = [];
      if (target.kind === 'card') {
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 2,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
        return events;
      }
      if (target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
      events.push({
        t: 'DamageDealt',
        damages: [
          {
            source: self,
            target: { kind: 'player', id: target.id },
            amount: 2,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal',
          },
        ],
      });
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(1, library.length);
      if (n > 0) {
        const top = library.slice(library.length - n);
        events.push(
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        );
      }
      return events;
    },
  },
};
