// `Taken by Nightmares` — exile, then the scry ONLY behind an enchantment
// I control. The ask is emitted LAST (D195): an effect that stops to ask
// must be the final one, or everything after it is silently dropped. D256.

import { TAKEN_BY_NIGHTMARES } from '../../../data/fixtures/engineCards';
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
  TAKEN_BY_NIGHTMARES,
  'Exile target creature. If you control an enchantment, scry 2.',
);

export const TAKEN_BY_NIGHTMARES_SCRIPT: CardScript = {
  oracleId: TAKEN_BY_NIGHTMARES.oracleId,
  name: TAKEN_BY_NIGHTMARES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
      ];
      let enchantment = false;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Enchantment')) {
          enchantment = true;
          break;
        }
      }
      if (!enchantment) return events;
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
          thenDraw: 0,
          label: 'Taken by Nightmares — scry 2',
        },
      });
      return events;
    },
  },
};
