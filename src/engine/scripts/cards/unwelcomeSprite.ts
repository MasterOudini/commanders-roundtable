// `Unwelcome Sprite` — flying plus a cast watcher gated on "during an
// OPPONENT'S turn", which the engine answers from `turn.activePlayer` with no
// input from anybody (Thran Vigil's condition, D259, inverted). The keyword
// line never counts, so the def's text is `split[1]`. D264.

import { UNWELCOME_SPRITE } from '../../../data/fixtures/engineCards';
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
  UNWELCOME_SPRITE,
  'Flying\nWhenever you cast a spell during an opponent\'s turn, surveil 2. (Look at the top two cards of your library. You may put any number of them into your graveyard and the rest on top of your library in any order.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const UNWELCOME_SPRITE_SCRIPT: CardScript = {
  oracleId: UNWELCOME_SPRITE.oracleId,
  name: UNWELCOME_SPRITE.name,
  triggers: [
    {
      abilityId: 'cast-on-their-turn',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        const mine = ctx.query.controllerOf(self);
        if (ev.obj.controller !== mine) return false;
        // "during an opponent's turn" — anybody's turn but my own.
        return ctx.state.turn.activePlayer !== mine;
      },
      label: () => 'Unwelcome Sprite — surveil 2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
