// `Stargaze` — look at 2X, take X to hand and the rest to the graveyard,
// lose X: the reveal and the loss land first, the chooseFromZone ask LAST
// with rest 'graveyard' (Demon's Due's order). D252.

import { STARGAZE } from '../../../data/fixtures/engineCards';
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
  STARGAZE,
  'Look at twice X cards from the top of your library. Put X cards from among them into your hand and the rest into your graveyard. You lose X life.',
);

export const STARGAZE_SCRIPT: CardScript = {
  oracleId: STARGAZE.oracleId,
  name: STARGAZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2 * x, library.length);
      if (n === 0) return [];
      const take = Math.min(x, n);
      const top = library.slice(library.length - n);
      const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [obj.controller] }];
      const player = ctx.state.players[obj.controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -x, to: player.life - x });
      }
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'chooseFromZone',
          player: obj.controller,
          zone: 'library',
          rest: 'graveyard',
          count: take,
          label: `Stargaze — put ${take} into your hand`,
        },
      });
      return events;
    },
  },
};
