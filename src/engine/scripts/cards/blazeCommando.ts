// `Blaze Commando` — "Whenever an instant or sorcery spell you control deals
// damage, create two 1/1 red and white Soldier creature tokens with haste."
// The first NON-COMBAT-damage watcher: `DamageDealt` fires once per resolving
// object however many targets it burned, which is exactly the card's "once
// per spell" (CR 603.2c-adjacent), so per-event firing is correct here where
// Aya's per-creature combat count is not. The spell's card is still on the
// stack when its damage lands, so `derive` answers for its type and its
// controller. M6.4g, D164.

import { BLAZE_COMMANDO } from '../../../data/fixtures/engineCards';
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
  BLAZE_COMMANDO,
  'Whenever an instant or sorcery spell you control deals damage, create two 1/1 red and white Soldier creature tokens with haste.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1|RW|Creature|haste');

export const BLAZE_COMMANDO_SCRIPT: CardScript = {
  oracleId: BLAZE_COMMANDO.oracleId,
  name: BLAZE_COMMANDO.name,
  triggers: [
    {
      abilityId: 'spell-damage',
      text: TEXT,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'DamageDealt') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.damages.some((d) => {
          if (d.amount <= 0) return false;
          const src = ctx.state.cards[d.source];
          if (!src || src.controller !== mine) return false;
          const types = ctx.derive(d.source).typeLine.types;
          return types.includes('Instant') || types.includes('Sorcery');
        });
      },
      label: () => 'Blaze Commando — create two 1/1 Soldiers with haste',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
