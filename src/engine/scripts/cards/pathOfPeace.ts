// `Path of Peace` — Misfortune's Gain's exact printed text on a second
// oracle id: the destroy paying the OWNER, read before the move. D232.

import { PATH_OF_PEACE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PATH_OF_PEACE, 'Destroy target creature. Its owner gains 4 life.');

export const PATH_OF_PEACE_SCRIPT: CardScript = {
  oracleId: PATH_OF_PEACE.oracleId,
  name: PATH_OF_PEACE.name,
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
