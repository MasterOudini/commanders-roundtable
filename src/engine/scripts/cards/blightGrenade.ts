// `Blight Grenade` — "Destroy target creature.\nAll creatures get -3/-3
// until end of turn." Certain Death's destroy (D202, indestructible
// survives) followed by Drown in Sorrow's board-wide debuff (D209) over
// every creature STILL there — the destroyed one has already left in the
// same resolve, so it is not in the sweep, exactly as the card reads. D272.

import { BLIGHT_GRENADE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BLIGHT_GRENADE, 'Destroy target creature.\nAll creatures get -3/-3 until end of turn.');

export const BLIGHT_GRENADE_SCRIPT: CardScript = {
  oracleId: BLIGHT_GRENADE.oracleId,
  name: BLIGHT_GRENADE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      const destroyed = !ctx.derive(target.id).keywords.has('indestructible');
      if (destroyed) {
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
      for (const id of ctx.state.zones.battlefield) {
        if (destroyed && id === target.id) continue;
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -3, toughness: -3, keywords: [] });
      }
      return events;
    },
  },
};
