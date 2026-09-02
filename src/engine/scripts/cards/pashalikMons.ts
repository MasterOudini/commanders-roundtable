// `Pashalik Mons` — "Whenever Pashalik Mons or another Goblin you control
// dies, Pashalik Mons deals 1 damage to any target.\n{3}{R}, Sacrifice a
// Goblin: Create two 1/1 red Goblin creature tokens." Headless Rider's
// self-or-tribe dies watcher (D179) aimed by Festering Goblin's dies target
// (D277's Marker Beetles), the damage sourced from Mons — which may itself
// be in the graveyard by then, the resolve reads its derived keywords all
// the same — and Arms Dealer's Goblin-sacrifice chooser making two of the
// pool's Goblins. Sacrificing a Goblin to the second line fires the first.
// D278.

import { PASHALIK_MONS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  PASHALIK_MONS,
  'Whenever Pashalik Mons or another Goblin you control dies, Pashalik Mons deals 1 damage to any target.\n{3}{R}, Sacrifice a Goblin: Create two 1/1 red Goblin creature tokens.',
);
const DIES = PRINTED.split('\n')[0] as string;
const MAKE = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GOBLIN = tokenRef('Goblin|1/1|R|Creature|');

/** Itself, or another Goblin I control — asked of the PRE-event state (looksBack). */
function selfOrMyGoblin(ctx: ScriptCtx, self: InstanceId, id: InstanceId): boolean {
  if (id === self) return true;
  const inst = ctx.state.cards[id];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(id).typeLine.subtypes.includes('Goblin');
}

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

export const PASHALIK_MONS_SCRIPT: CardScript = {
  oracleId: PASHALIK_MONS.oracleId,
  name: PASHALIK_MONS.name,
  triggers: [
    {
      abilityId: 'goblin-dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(DIES),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && selfOrMyGoblin(ctx, self, m.card),
        ),
      label: () => 'Pashalik Mons — 1 damage to any target',
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
  activated: [
    {
      ref: `${PASHALIK_MONS.oracleId}#a0`,
      text: MAKE,
      resolve: (ctx, _self, obj): readonly EventBody[] => [goblin(ctx, obj.controller), goblin(ctx, obj.controller)],
    },
  ],
};
