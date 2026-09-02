// `Prosperous Innkeeper` — "When this creature enters, create a Treasure
// token. (reminder)\nWhenever another creature you control enters, you gain
// 1 life." A self-entry Treasure and Dazzling Angel's EXACT second line
// (D170): the "another creature you control" entry PAIR — a card def and a
// token def — narrowed to my side. D279.

import { PROSPEROUS_INNKEEPER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  PROSPEROUS_INNKEEPER,
  'When this creature enters, create a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")\nWhenever another creature you control enters, you gain 1 life.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const ANOTHER = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

/** "another creature you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Creature');
}

function gainOne(ctx: ScriptCtx, obj: { readonly controller: string }): readonly EventBody[] {
  const me = ctx.state.players[obj.controller];
  if (!me || me.hasLost) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
}

export const PROSPEROUS_INNKEEPER_SCRIPT: CardScript = {
  oracleId: PROSPEROUS_INNKEEPER.oracleId,
  name: PROSPEROUS_INNKEEPER.name,
  triggers: [
    {
      abilityId: 'enters-treasure',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Prosperous Innkeeper — create a Treasure',
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
    {
      abilityId: 'another-card',
      text: ANOTHER,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && qualifies(ctx, self, m.card),
        ),
      label: () => 'Prosperous Innkeeper — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
    {
      abilityId: 'another-token',
      text: ANOTHER,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Prosperous Innkeeper — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
  ],
};
