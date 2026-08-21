// `Rain of Daggers` — "Destroy all creatures target opponent controls.
// You lose 2 life for each creature destroyed this way." The one-player
// wipe with the per-kill bill — indestructible survivors are not
// destroyed this way and cost nothing. D237.

import { RAIN_OF_DAGGERS } from '../../../data/fixtures/engineCards';
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
  RAIN_OF_DAGGERS,
  'Destroy all creatures target opponent controls. You lose 2 life for each creature destroyed this way.',
);

export const RAIN_OF_DAGGERS_SCRIPT: CardScript = {
  oracleId: RAIN_OF_DAGGERS.oracleId,
  name: RAIN_OF_DAGGERS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      const events: EventBody[] = [{ t: 'CardsMoved', moves }];
      const caster = ctx.state.players[obj.controller];
      if (caster && !caster.hasLost) {
        const loss = 2 * moves.length;
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -loss, to: caster.life - loss });
      }
      return events;
    },
  },
};
