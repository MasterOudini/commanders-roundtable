// `Sek'Kuar, Deathkeeper` — "Whenever another nontoken creature you
// control dies, create a 3/1 black and red Graveborn creature token with
// haste." Headless Rider's watcher paying the Graveborn — a LEGENDARY
// joins the pool. D245.

import { SEK_KUAR_DEATHKEEPER } from '../../../data/fixtures/engineCards';
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
  SEK_KUAR_DEATHKEEPER,
  'Whenever another nontoken creature you control dies, create a 3/1 black and red Graveborn creature token with haste.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GRAVEBORN = tokenRef('Graveborn|3/1|BR|Creature|haste');

export const SEK_KUAR_DEATHKEEPER_SCRIPT: CardScript = {
  oracleId: SEK_KUAR_DEATHKEEPER.oracleId,
  name: SEK_KUAR_DEATHKEEPER.name,
  triggers: [
    {
      abilityId: 'dies-graveborn',
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
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => "Sek'Kuar, Deathkeeper — create a 3/1 Graveborn with haste",
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GRAVEBORN.oracleId,
          printingId: GRAVEBORN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
