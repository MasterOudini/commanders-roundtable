// `Barbed Batterfist` - a etb trigger germ, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BARBED_BATTERFIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BARBED_BATTERFIST, "For Mirrodin! (When this Equipment enters, create a 2/2 red Rebel creature token, then attach this to it.)\nEquipped creature gets +1/-1.\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Rebel|2/2|R|Creature|");

export const BARBED_BATTERFIST_SCRIPT: CardScript = {
  oracleId: BARBED_BATTERFIST.oracleId,
  name: BARBED_BATTERFIST.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Barbed Batterfist - germ",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        const germ = ctx.ids.nextInstance();
        return [
          { t: 'TokenCreated', card: germ, oracleId: TOKEN_L0.oracleId, printingId: TOKEN_L0.printingId, controller: obj.controller, owner: obj.controller, turnNumber: ctx.state.turn.turnNumber },
          { t: 'AttachmentChanged', card: self, to: germ },
        ];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += -1;
      },
    },
  ],
};
