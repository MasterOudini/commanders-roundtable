// `Headless Rider` — "Whenever this creature or another nontoken Zombie you
// control dies, create a 2/2 black Zombie creature token." Golgari
// Germination's nontoken dies watcher with Genghis Frog's self-inclusion:
// the Rider is itself a nontoken Zombie, and the printed line spells the
// self arm out. The token is the same 2/2 the pool already holds. M6.4w,
// D179.

import { HEADLESS_RIDER } from '../../../data/fixtures/engineCards';
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
  HEADLESS_RIDER,
  'Whenever this creature or another nontoken Zombie you control dies, create a 2/2 black Zombie creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ZOMBIE = tokenRef('Zombie|2/2|B|Creature|');

export const HEADLESS_RIDER_SCRIPT: CardScript = {
  oracleId: HEADLESS_RIDER.oracleId,
  name: HEADLESS_RIDER.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.card === self) return true;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.subtypes.includes('Zombie');
        }),
      label: () => 'Headless Rider — create a 2/2 Zombie',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ZOMBIE.oracleId,
          printingId: ZOMBIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
