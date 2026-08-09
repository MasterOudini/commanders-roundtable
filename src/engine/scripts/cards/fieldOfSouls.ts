// `Field of Souls` — "Whenever a nontoken creature is put into your
// graveyard from the battlefield, create a 1/1 white Spirit creature token
// with flying." Femeref Enchantress's dies watcher narrowed three ways: the
// grave is MINE, the mover is a CREATURE (asked of the BEFORE board), and
// `CardInstance.isToken` carries the nontoken filter. M6.4s, D175.

import { FIELD_OF_SOULS } from '../../../data/fixtures/engineCards';
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
  FIELD_OF_SOULS,
  'Whenever a nontoken creature is put into your graveyard from the battlefield, create a 1/1 white Spirit creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

export const FIELD_OF_SOULS_SCRIPT: CardScript = {
  oracleId: FIELD_OF_SOULS.oracleId,
  name: FIELD_OF_SOULS.name,
  triggers: [
    {
      abilityId: 'nontoken-dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.to.player !== ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.isToken) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Field of Souls — create a 1/1 Spirit with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
