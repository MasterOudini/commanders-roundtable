// `Titania, Protector of Argoth` - enters: return target land card from your
// graveyard to the battlefield (D298's typed card noun); whenever a land you
// control is put into a graveyard from the battlefield, a 5/3 green Elemental
// token - once PER land (per-item, D185; a look-back trigger).

import { TITANIA_PROTECTOR_OF_ARGOTH } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  TITANIA_PROTECTOR_OF_ARGOTH,
  'When Titania enters, return target land card from your graveyard to the battlefield.\nWhenever a land you control is put into a graveyard from the battlefield, create a 5/3 green Elemental creature token.',
);
const ENTERS_TEXT = PRINTED.split('\n')[0] as string;
const LAND_DIES_TEXT = PRINTED.split('\n')[1] as string;
const ELEMENTAL = tokenRef('Elemental|5/3|G|Creature|');

export const TITANIA_PROTECTOR_OF_ARGOTH_SCRIPT: CardScript = {
  oracleId: TITANIA_PROTECTOR_OF_ARGOTH.oracleId,
  name: TITANIA_PROTECTOR_OF_ARGOTH.name,
  triggers: [
    {
      abilityId: 'etb',
      text: ENTERS_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS_TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Titania, Protector of Argoth - return a land card to the battlefield',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
    {
      abilityId: 'land-dies',
      text: LAND_DIES_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return [];
        const me = ctx.query.controllerOf(self);
        return ev.moves
          .filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === me && ctx.derive(m.card).typeLine.types.includes('Land'))
          .map((m) => m.card);
      },
      label: () => 'Titania, Protector of Argoth - create a 5/3 Elemental',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ELEMENTAL.oracleId,
          printingId: ELEMENTAL.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
