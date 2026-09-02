// `Dispatch` — "Tap target creature.\nMetalcraft — If you control three or
// more artifacts, exile that creature." Akroan Jailer's tap (the engine's
// own PermanentsTapped, skipped for a creature already tapped) and then the
// Metalcraft count, asked of the DERIVED types of what I control at
// resolution: three artifacts or more and the creature is exiled to its
// owner's zone; fewer and the tap is all. D274.

import { DISPATCH } from '../../../data/fixtures/engineCards';
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
  DISPATCH,
  'Tap target creature.\nMetalcraft — If you control three or more artifacts, exile that creature.',
);

export const DISPATCH_SCRIPT: CardScript = {
  oracleId: DISPATCH.oracleId,
  name: DISPATCH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      if (!card.tapped) events.push({ t: 'PermanentsTapped', cards: [target.id] });
      let artifacts = 0;
      for (const id of ctx.state.zones.battlefield) {
        const c = ctx.state.cards[id];
        if (!c || c.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) artifacts += 1;
      }
      if (artifacts >= 3) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        });
      }
      return events;
    },
  },
};
