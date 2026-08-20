// `Pitiless Plunderer` — "Whenever another creature you control dies,
// create a Treasure token." The Vivisector's watcher with "another" and
// a Treasure payoff; its own death pays nothing. D233.

import { PITILESS_PLUNDERER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  PITILESS_PLUNDERER,
  'Whenever another creature you control dies, create a Treasure token. ' +
    "(It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const PITILESS_PLUNDERER_SCRIPT: CardScript = {
  oracleId: PITILESS_PLUNDERER.oracleId,
  name: PITILESS_PLUNDERER.name,
  triggers: [
    {
      abilityId: 'dies-treasure',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.card === self) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Pitiless Plunderer — create a Treasure token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: TREASURE.oracleId,
          printingId: TREASURE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
