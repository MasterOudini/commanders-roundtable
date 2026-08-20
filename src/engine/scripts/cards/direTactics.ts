// `Dire Tactics` — "Exile target creature. If you don't control a Human,
// you lose life equal to that creature's toughness." The Human check and
// the toughness are both read off the DERIVED pre-move state. D208.

import { DIRE_TACTICS } from '../../../data/fixtures/engineCards';
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
  DIRE_TACTICS,
  "Exile target creature. If you don't control a Human, you lose life equal to that creature's toughness.",
);

export const DIRE_TACTICS_SCRIPT: CardScript = {
  oracleId: DIRE_TACTICS.oracleId,
  name: DIRE_TACTICS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const toughness = ctx.derive(target.id).toughness ?? 0;
      let human = false;
      for (const id of ctx.state.zones.battlefield) {
        const c = ctx.state.cards[id];
        if (!c || c.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Human')) {
          human = true;
          break;
        }
      }
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
      const me = ctx.state.players[obj.controller];
      if (!human && toughness > 0 && me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: -toughness,
          to: me.life - toughness,
        });
      }
      return events;
    },
  },
};
