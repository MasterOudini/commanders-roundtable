// `Dragonlair Spider` — "Reach\nWhenever an opponent casts a spell, create a
// 1/1 green Insect creature token." Arasta's opponent-cast shape on a bigger
// body. M6.4p, D172.

import { DRAGONLAIR_SPIDER } from '../../../data/fixtures/engineCards';
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
  DRAGONLAIR_SPIDER,
  'Reach\nWhenever an opponent casts a spell, create a 1/1 green Insect creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const INSECT = tokenRef('Insect|1/1|G|Creature|');

export const DRAGONLAIR_SPIDER_SCRIPT: CardScript = {
  oracleId: DRAGONLAIR_SPIDER.oracleId,
  name: DRAGONLAIR_SPIDER.name,
  triggers: [
    {
      abilityId: 'opp-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self),
      label: () => 'Dragonlair Spider — create a 1/1 Insect',
      // The token goes to the ABILITY's controller, not the caster —
      // `obj.controller` is captured at fire time (D161's rule).
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: INSECT.oracleId,
          printingId: INSECT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
