// `Emmara, Soul of the Accord` — "Whenever Emmara becomes tapped, create a
// 1/1 white Soldier creature token with lifelink." The FIRST becomes-tapped
// SELF watcher (D173): `PermanentsTapped` is emitted by every tap path —
// attack declaration, {T} costs, mana abilities, tap effects, the Tier-3
// wrench — so the one filter `ev.cards.includes(self)` is the whole printed
// condition. M6.4q, D173.

import { EMMARA_SOUL_OF_THE_ACCORD } from '../../../data/fixtures/engineCards';
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
  EMMARA_SOUL_OF_THE_ACCORD,
  'Whenever Emmara becomes tapped, create a 1/1 white Soldier creature token with lifelink.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1|W|Creature|lifelink');

export const EMMARA_SOUL_OF_THE_ACCORD_SCRIPT: CardScript = {
  oracleId: EMMARA_SOUL_OF_THE_ACCORD.oracleId,
  name: EMMARA_SOUL_OF_THE_ACCORD.name,
  triggers: [
    {
      abilityId: 'self-tapped',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Emmara, Soul of the Accord — create a 1/1 Soldier with lifelink',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
