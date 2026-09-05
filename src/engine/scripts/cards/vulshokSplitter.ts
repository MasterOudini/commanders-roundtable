// `Vulshok Splitter` - a etb trigger germ, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VULSHOK_SPLITTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VULSHOK_SPLITTER, "For Mirrodin! (When this Equipment enters, create a 2/2 red Rebel creature token, then attach this to it.)\nEquipped creature gets +2/+0.\nEquip {2}{R} ({2}{R}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Rebel|2/2|R|Creature|");

export const VULSHOK_SPLITTER_SCRIPT: CardScript = {
  oracleId: VULSHOK_SPLITTER.oracleId,
  name: VULSHOK_SPLITTER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Vulshok Splitter - germ",
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
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
