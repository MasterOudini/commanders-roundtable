// `Knightfisher` — "Whenever another nontoken Bird you control enters,
// create a 1/1 blue Fish creature token." ONE def, deliberately: a token
// Bird is excluded by the printed NONTOKEN, so a `TokenCreated` arm could
// never match and would be dead code wearing coverage. M6.4ab, D184.

import { KNIGHTFISHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  KNIGHTFISHER,
  'Flying\nWhenever another nontoken Bird you control enters, create a 1/1 blue Fish creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FISH = tokenRef('Fish|1/1|U|Creature|');

export const KNIGHTFISHER_SCRIPT: CardScript = {
  oracleId: KNIGHTFISHER.oracleId,
  name: KNIGHTFISHER.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          if (m.card === self) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.subtypes.includes('Bird');
        }),
      label: () => 'Knightfisher — create a 1/1 Fish',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FISH.oracleId,
          printingId: FISH.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
