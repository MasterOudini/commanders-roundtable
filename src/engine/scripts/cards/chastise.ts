// `Chastise` — destroy the attacker and gain life equal to its power, read
// (derived) before it dies. The combat role is the parser's and the
// validator's (D291).

import { CHASTISE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CHASTISE, 'Destroy target attacking creature. You gain life equal to its power.');

export const CHASTISE_SCRIPT: CardScript = {
  oracleId: CHASTISE.oracleId,
  name: CHASTISE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      const power = ctx.derive(target.id).power ?? 0;
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'graveyard', player: card.owner } }],
        });
      }
      const me = ctx.state.players[obj.controller];
      if (me && power > 0) events.push({ t: 'LifeChanged', player: obj.controller, delta: power, to: me.life + power });
      return events;
    },
  },
};
