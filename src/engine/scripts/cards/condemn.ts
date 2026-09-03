// `Condemn` — the attacker goes to the BOTTOM of its owner's library and its
// controller gains life equal to its (derived) toughness. D291's role.

import { CONDEMN } from '../../../data/fixtures/engineCards';
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
  CONDEMN,
  "Put target attacking creature on the bottom of its owner's library. Its controller gains life equal to its toughness.",
);

export const CONDEMN_SCRIPT: CardScript = {
  oracleId: CONDEMN.oracleId,
  name: CONDEMN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const toughness = ctx.derive(target.id).toughness ?? 0;
      const controller = card.controller;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [{ card: target.id, from: { kind: 'battlefield', player: controller }, to: { kind: 'library', player: card.owner }, placement: 'bottom' }],
        },
      ];
      const p = ctx.state.players[controller];
      if (p && toughness > 0) events.push({ t: 'LifeChanged', player: controller, delta: toughness, to: p.life + toughness });
      return events;
    },
  },
};
