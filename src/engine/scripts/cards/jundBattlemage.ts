// `Jund Battlemage` — "{B}, {T}: Target player loses 1 life.\n{G}, {T}:
// Create a 1/1 green Saproling creature token." The guildmage tap carrier
// (D272's family) with effects the generator's table does not hold: a
// targeted life loss and the pool's Saproling. Hand-written. D277.

import { JUND_BATTLEMAGE } from '../../../data/fixtures/engineCards';
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
  JUND_BATTLEMAGE,
  '{B}, {T}: Target player loses 1 life.\n{G}, {T}: Create a 1/1 green Saproling creature token.',
);
const DRAIN = PRINTED.split('\n')[0] as string;
const SAPROLING_LINE = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const JUND_BATTLEMAGE_SCRIPT: CardScript = {
  oracleId: JUND_BATTLEMAGE.oracleId,
  name: JUND_BATTLEMAGE.name,
  activated: [
    {
      ref: `${JUND_BATTLEMAGE.oracleId}#a0`,
      text: DRAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: them.life - 1 }];
      },
    },
    {
      ref: `${JUND_BATTLEMAGE.oracleId}#a1`,
      text: SAPROLING_LINE,
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
