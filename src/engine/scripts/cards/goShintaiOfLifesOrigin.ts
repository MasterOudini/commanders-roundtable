// `Go-Shintai of Life's Origin` - "{W}{U}{B}{R}{G}, {T}: Return target enchantment
// card from your graveyard to the battlefield." (D298's typed card noun) and
// "Whenever Go-Shintai of Life's Origin or another nontoken Shrine you control
// enters, create a 1/1 colorless Shrine enchantment creature token." - once PER
// Shrine (per-item, D185), itself included.

import { GO_SHINTAI_OF_LIFE_S_ORIGIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  GO_SHINTAI_OF_LIFE_S_ORIGIN,
  "{W}{U}{B}{R}{G}, {T}: Return target enchantment card from your graveyard to the battlefield.\nWhenever Go-Shintai of Life's Origin or another nontoken Shrine you control enters, create a 1/1 colorless Shrine enchantment creature token.",
);
const RETURN_TEXT = PRINTED.split('\n')[0] as string;
const SHRINE_TEXT = PRINTED.split('\n')[1] as string;
const SHRINE = tokenRef('Shrine|1/1||Creature Enchantment|');

export const GO_SHINTAI_OF_LIFES_ORIGIN_SCRIPT: CardScript = {
  oracleId: GO_SHINTAI_OF_LIFE_S_ORIGIN.oracleId,
  name: GO_SHINTAI_OF_LIFE_S_ORIGIN.name,
  activated: [
    {
      ref: `${GO_SHINTAI_OF_LIFE_S_ORIGIN.oracleId}#a0`,
      text: RETURN_TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'shrine-enters',
      text: SHRINE_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return [];
        const me = ctx.query.controllerOf(self);
        return ev.moves
          .filter((m) => {
            if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
            if (m.card === self) return true;
            const c = ctx.state.cards[m.card];
            return !!c && !c.isToken && c.controller === me && ctx.derive(m.card).typeLine.subtypes.includes('Shrine');
          })
          .map((m) => m.card);
      },
      label: () => "Go-Shintai of Life's Origin - create a 1/1 Shrine",
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SHRINE.oracleId,
          printingId: SHRINE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
