// `Bishop of Wings` — "Whenever an Angel you control enters, you gain 4
// life.\nWhenever an Angel you control dies, create a 1/1 white Spirit
// creature token with flying." Dazzling Angel's entry PAIR (D170 — a card
// def and a token def, because Angel tokens enter too) narrowed to the
// ANGEL subtype, and Headless Rider's looks-back dies watcher (D179) over
// the same predicate — tokens included this time, the card says "an Angel".
// The Bishop is a Human Cleric: it never trips its own watchers. The Spirit
// is the pool's flying 1/1 (tmm2 5). D272.

import { BISHOP_OF_WINGS } from '../../../data/fixtures/engineCards';
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
  BISHOP_OF_WINGS,
  'Whenever an Angel you control enters, you gain 4 life.\nWhenever an Angel you control dies, create a 1/1 white Spirit creature token with flying.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const DIES = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

/** "an Angel you control" — asked of the DERIVED card, on whichever side of the event `ctx` is. */
function myAngel(ctx: ScriptCtx, self: InstanceId, id: InstanceId): boolean {
  const inst = ctx.state.cards[id];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(id).typeLine.subtypes.includes('Angel');
}

function gainFour(ctx: ScriptCtx, obj: { readonly controller: string }): readonly EventBody[] {
  const me = ctx.state.players[obj.controller];
  if (!me || me.hasLost) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
}

export const BISHOP_OF_WINGS_SCRIPT: CardScript = {
  oracleId: BISHOP_OF_WINGS.oracleId,
  name: BISHOP_OF_WINGS.name,
  triggers: [
    {
      abilityId: 'angel-enters-card',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && myAngel(ctx, self, m.card),
        ),
      label: () => 'Bishop of Wings — you gain 4 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainFour(ctx, obj),
    },
    {
      abilityId: 'angel-enters-token',
      text: ENTERS,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && myAngel(ctx, self, ev.card),
      label: () => 'Bishop of Wings — you gain 4 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainFour(ctx, obj),
    },
    {
      abilityId: 'angel-dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && myAngel(ctx, self, m.card),
        ),
      label: () => 'Bishop of Wings — create a 1/1 Spirit with flying',
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
