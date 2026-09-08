// `Thopter Squadron` - a static entersWithCounters, an activation token, an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THOPTER_SQUADRON } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(THOPTER_SQUADRON, "Flying\nThis creature enters with three +1/+1 counters on it.\n{1}, Remove a +1/+1 counter from this creature: Create a 1/1 colorless Thopter artifact creature token with flying. Activate only as a sorcery.\n{1}, Sacrifice another Thopter: Put a +1/+1 counter on this creature. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Thopter|1/1||Artifact Creature|flying");

export const THOPTER_SQUADRON_SCRIPT: CardScript = {
  oracleId: THOPTER_SQUADRON.oracleId,
  name: THOPTER_SQUADRON.name,
  activated: [
    {
      ref: `${THOPTER_SQUADRON.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
    {
      ref: `${THOPTER_SQUADRON.oracleId}#a1`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D365).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 3 }] }],
    },
  ],
};
