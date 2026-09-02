// `Seraph Sanctuary` — "When this land enters, you gain 1 life.\nWhenever an
// Angel you control enters, you gain 1 life.\n{T}: Add {C}." A land with a
// self-entry gain and Bishop of Wings' Angel entry PAIR (D272: a card def and
// a token def, tokens are Angels too). The mana line is the engine's. D280.

import { SERAPH_SANCTUARY } from '../../../data/fixtures/engineCards';
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
  SERAPH_SANCTUARY,
  'When this land enters, you gain 1 life.\nWhenever an Angel you control enters, you gain 1 life.\n{T}: Add {C}.',
);
const SELF = PRINTED.split('\n')[0] as string;
const ANGEL = PRINTED.split('\n')[1] as string;

function myAngel(ctx: ScriptCtx, self: InstanceId, id: InstanceId): boolean {
  const inst = ctx.state.cards[id];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(id).typeLine.subtypes.includes('Angel');
}

function gainOne(ctx: ScriptCtx, obj: { readonly controller: string }): readonly EventBody[] {
  const me = ctx.state.players[obj.controller];
  if (!me || me.hasLost) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
}

export const SERAPH_SANCTUARY_SCRIPT: CardScript = {
  oracleId: SERAPH_SANCTUARY.oracleId,
  name: SERAPH_SANCTUARY.name,
  triggers: [
    {
      abilityId: 'enters',
      text: SELF,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Seraph Sanctuary — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
    {
      abilityId: 'angel-enters-card',
      text: ANGEL,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && myAngel(ctx, self, m.card),
        ),
      label: () => 'Seraph Sanctuary — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
    {
      abilityId: 'angel-enters-token',
      text: ANGEL,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && myAngel(ctx, self, ev.card),
      label: () => 'Seraph Sanctuary — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
  ],
};
