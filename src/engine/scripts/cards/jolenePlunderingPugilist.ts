// `Jolene, Plundering Pugilist` — "Whenever you attack with one or more
// creatures with power 4 or greater, create a Treasure token.\n{1}{R},
// Sacrifice a Treasure: Jolene deals 1 damage to any target." An attack
// watcher that matches when ANY declared attacker of mine has derived power
// 4 or more (a batch match on AttackersDeclared, D185), making the pool's
// Treasure; and an artifact-SUBTYPE sacrifice chooser (Guardian of
// Cloverdell's Kithkin one type over, D275) paying for a ping with Jolene as
// the source. D277.

import { JOLENE_PLUNDERING_PUGILIST } from '../../../data/fixtures/engineCards';
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
  JOLENE_PLUNDERING_PUGILIST,
  'Whenever you attack with one or more creatures with power 4 or greater, create a Treasure token.\n{1}{R}, Sacrifice a Treasure: Jolene deals 1 damage to any target.',
);
const ATTACK = PRINTED.split('\n')[0] as string;
const PING = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const JOLENE_PLUNDERING_PUGILIST_SCRIPT: CardScript = {
  oracleId: JOLENE_PLUNDERING_PUGILIST.oracleId,
  name: JOLENE_PLUNDERING_PUGILIST.name,
  triggers: [
    {
      abilityId: 'big-attack',
      text: ATTACK,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        ev.attackers.some((a) => {
          const inst = ctx.state.cards[a.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          const power = ctx.derive(a.card).power;
          return power !== null && power >= 4;
        }),
      label: () => 'Jolene, Plundering Pugilist — create a Treasure',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: TREASURE.oracleId,
          printingId: TREASURE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
  activated: [
    {
      ref: `${JOLENE_PLUNDERING_PUGILIST.oracleId}#a0`,
      text: PING,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
