// `Read the Bones` — scry 2 (revealed first, D195), then draw two: the draw
// rides the ask as `thenDraw` and is dealt by the answer handler against the
// reordered library. The 2 life is paid in the same resolution.

import { READ_THE_BONES } from '../../../data/fixtures/engineCards';
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
  READ_THE_BONES,
  'Scry 2, then draw two cards. You lose 2 life. (To scry 2, look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)',
);

export const READ_THE_BONES_SCRIPT: CardScript = {
  oracleId: READ_THE_BONES.oracleId,
  name: READ_THE_BONES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) events.push({ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 });
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const count = Math.min(2, library.length);
      if (count === 0) return events;
      events.push({ t: 'CardsRevealed', cards: library.slice(library.length - count), to: [obj.controller] });
      events.push({
        t: 'AwaitingSet',
        awaiting: { kind: 'scryChoice', player: obj.controller, count, toGraveyard: false, thenDraw: 2, label: obj.label },
      });
      return events;
    },
  },
};
