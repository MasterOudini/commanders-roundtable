// `Sultai Flayer` — the dies watcher with a DERIVED TOUGHNESS filter:
// Shadewing Laureate one stat over. The toughness is read off the BEFORE
// state (looksBack), because a dead creature has no derivation. D255.

import { SULTAI_FLAYER } from '../../../data/fixtures/engineCards';
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
  SULTAI_FLAYER,
  'Whenever a creature you control with toughness 4 or greater dies, you gain 4 life.',
);

export const SULTAI_FLAYER_SCRIPT: CardScript = {
  oracleId: SULTAI_FLAYER.oracleId,
  name: SULTAI_FLAYER.name,
  triggers: [
    {
      abilityId: 'tough-dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.state.cards[self]?.controller;
        if (!mine) return false;
        return ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== mine) return false;
          const d = ctx.derive(m.card);
          return d.typeLine.types.includes('Creature') && (d.toughness ?? 0) >= 4;
        });
      },
      label: () => 'Sultai Flayer — you gain 4 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: player.life + 4 }];
      },
    },
  ],
};
