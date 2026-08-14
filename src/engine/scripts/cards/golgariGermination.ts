// `Golgari Germination` — "Whenever a nontoken creature you control dies,
// create a 1/1 green Saproling creature token." Field of Souls' nontoken
// dies watcher (D175) with the CONTROLLER filter in place of the owner-side
// graveyard: the dying creature must have been YOURS. M6.4u, D177.

import { GOLGARI_GERMINATION } from '../../../data/fixtures/engineCards';
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
  GOLGARI_GERMINATION,
  'Whenever a nontoken creature you control dies, create a 1/1 green Saproling creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const GOLGARI_GERMINATION_SCRIPT: CardScript = {
  oracleId: GOLGARI_GERMINATION.oracleId,
  name: GOLGARI_GERMINATION.name,
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
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Golgari Germination — create a 1/1 Saproling',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
