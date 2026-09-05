// `Accelerated Evolution` - a etb trigger attachedTemp, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ACCELERATED_EVOLUTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACCELERATED_EVOLUTION, "Flash\nEnchant creature you control\nWhen this Aura enters, enchanted creature gains hexproof until end of turn. (It can't be the target of spells or abilities your opponents control.)\nEnchanted creature gets +2/+2.");
const LINES = PRINTED.split('\n');

export const ACCELERATED_EVOLUTION_SCRIPT: CardScript = {
  oracleId: ACCELERATED_EVOLUTION.oracleId,
  name: ACCELERATED_EVOLUTION.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Accelerated Evolution - attachedTemp",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 0, toughness: 0, keywords: ["hexproof"] }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-3',
      text: LINES[3] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
