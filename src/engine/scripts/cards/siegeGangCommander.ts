// `Siege-Gang Commander` — "When this creature enters, create three 1/1 red
// Goblin creature tokens.\n{1}{R}, Sacrifice a Goblin: This creature deals 2
// damage to any target." Three of the pool's Goblins on entry, and Arms
// Dealer's Goblin-sacrifice ping with the Commander as the derived source —
// it may eat one of its own Goblins, or itself. D280.

import { SIEGE_GANG_COMMANDER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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
  SIEGE_GANG_COMMANDER,
  'When this creature enters, create three 1/1 red Goblin creature tokens.\n{1}{R}, Sacrifice a Goblin: This creature deals 2 damage to any target.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const PING = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GOBLIN = tokenRef('Goblin|1/1|R|Creature|');

function goblin(ctx: ScriptCtx, controller: string): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: GOBLIN.oracleId,
    printingId: GOBLIN.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const SIEGE_GANG_COMMANDER_SCRIPT: CardScript = {
  oracleId: SIEGE_GANG_COMMANDER.oracleId,
  name: SIEGE_GANG_COMMANDER.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Siege-Gang Commander — create three 1/1 Goblins',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        goblin(ctx, obj.controller),
        goblin(ctx, obj.controller),
        goblin(ctx, obj.controller),
      ],
    },
  ],
  activated: [
    {
      ref: `${SIEGE_GANG_COMMANDER.oracleId}#a0`,
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
                amount: 2,
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
