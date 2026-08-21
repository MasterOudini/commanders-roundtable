// `Shadowfeed` — "Exile target card from a graveyard. You gain 3 life."
// D246.

import { SHADOWFEED } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SHADOWFEED, 'Exile target card from a graveyard. You gain 3 life.');

export const SHADOWFEED_SCRIPT: CardScript = {
  oracleId: SHADOWFEED.oracleId,
  name: SHADOWFEED.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      const graveOwner = card.zone.player;
      if (!graveOwner) return [];
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: graveOwner },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
      ];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 });
      }
      return events;
    },
  },
};
