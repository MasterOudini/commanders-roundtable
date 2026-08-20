// `Demon's Due` — "Scry 2, then draw two cards. You lose 2 life." Cruel
// Truths one ask over: the flat loss COMMUTES with the scry and the draws,
// so it is emitted BEFORE the ask (which must be LAST — D195), and the two
// draws ride `thenDraw` against the answered library. D207.

import { DEMON_S_DUE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEMON_S_DUE, 'Scry 2, then draw two cards. You lose 2 life.');

export const DEMONS_DUE_SCRIPT: CardScript = {
  oracleId: DEMON_S_DUE.oracleId,
  name: DEMON_S_DUE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      const events: EventBody[] = [
        { t: 'LifeChanged', player: obj.controller, delta: -2, to: life - 2 },
      ];
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2, library.length);
      if (n === 0) return events;
      const top = library.slice(library.length - n);
      events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'scryChoice',
          player: obj.controller,
          count: n,
          toGraveyard: false,
          thenDraw: 2,
          label: obj.label,
        },
      });
      return events;
    },
  },
};
