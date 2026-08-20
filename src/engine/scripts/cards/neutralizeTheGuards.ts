// `Neutralize the Guards` — "Creatures target opponent controls get -1/-1
// until end of turn. Surveil 2." The one-player board debuff with the
// surveil ask LAST (D195's rule holds by construction). D228.

import { NEUTRALIZE_THE_GUARDS } from '../../../data/fixtures/engineCards';
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
  NEUTRALIZE_THE_GUARDS,
  'Creatures target opponent controls get -1/-1 until end of turn. Surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const NEUTRALIZE_THE_GUARDS_SCRIPT: CardScript = {
  oracleId: NEUTRALIZE_THE_GUARDS.oracleId,
  name: NEUTRALIZE_THE_GUARDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -1, toughness: -1 });
      }
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2, library.length);
      if (n > 0) {
        const top = library.slice(library.length - n);
        events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: obj.controller,
            count: n,
            toGraveyard: true,
            thenDraw: 0,
            label: obj.label,
          },
        });
      }
      return events;
    },
  },
};
