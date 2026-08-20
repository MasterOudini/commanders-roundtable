// `Misfortune's Gain` — "Destroy target creature. Its owner gains 4 life."
// Last Breath's rider pointed at the OWNER (not the controller), read
// before the move; an indestructible miss still pays nobody nothing — the
// gain is its own sentence and lands either way. D225.

import { MISFORTUNE_S_GAIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MISFORTUNE_S_GAIN, 'Destroy target creature. Its owner gains 4 life.');

export const MISFORTUNES_GAIN_SCRIPT: CardScript = {
  oracleId: MISFORTUNE_S_GAIN.oracleId,
  name: MISFORTUNE_S_GAIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const owner = card.owner;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const p = ctx.state.players[owner];
      if (p && !p.hasLost) {
        events.push({ t: 'LifeChanged', player: owner, delta: 4, to: p.life + 4 });
      }
      return events;
    },
  },
};
