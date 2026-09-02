// `Drogskol Cavalry` — "Flying\nWhenever another Spirit you control enters,
// you gain 2 life.\n{3}{W}: Create a 1/1 white Spirit creature token with
// flying." Dazzling Angel's entry PAIR (D170) narrowed to Spirits with the
// "another" exclusion, and an activation that makes the pool's flying Spirit
// — which is itself another Spirit entering, so each activation is also 2
// life, exactly as the card plays. The keyword line is the engine's; the
// activation is `#a0`. D274.

import { DROGSKOL_CAVALRY } from '../../../data/fixtures/engineCards';
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
  DROGSKOL_CAVALRY,
  'Flying\nWhenever another Spirit you control enters, you gain 2 life.\n{3}{W}: Create a 1/1 white Spirit creature token with flying.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const MAKE = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

/** "another Spirit you control" — asked of the DERIVED entrant. */
function anotherSpirit(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Spirit');
}

function gainTwo(ctx: ScriptCtx, obj: { readonly controller: string }): readonly EventBody[] {
  const me = ctx.state.players[obj.controller];
  if (!me || me.hasLost) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
}

export const DROGSKOL_CAVALRY_SCRIPT: CardScript = {
  oracleId: DROGSKOL_CAVALRY.oracleId,
  name: DROGSKOL_CAVALRY.name,
  triggers: [
    {
      abilityId: 'spirit-enters-card',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && anotherSpirit(ctx, self, m.card),
        ),
      label: () => 'Drogskol Cavalry — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainTwo(ctx, obj),
    },
    {
      abilityId: 'spirit-enters-token',
      text: ENTERS,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && anotherSpirit(ctx, self, ev.card),
      label: () => 'Drogskol Cavalry — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainTwo(ctx, obj),
    },
  ],
  activated: [
    {
      ref: `${DROGSKOL_CAVALRY.oracleId}#a0`,
      text: MAKE,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
