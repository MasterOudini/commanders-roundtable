// `Despondency` - a static attachedStatic, a auraToGraveyard trigger bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DESPONDENCY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DESPONDENCY, "Enchant creature\nEnchanted creature gets -2/-0.\nWhen this Aura is put into a graveyard from the battlefield, return it to its owner's hand.");
const LINES = PRINTED.split('\n');

export const DESPONDENCY_SCRIPT: CardScript = {
  oracleId: DESPONDENCY.oracleId,
  name: DESPONDENCY.name,
  triggers: [
    {
      abilityId: 'auraToGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Despondency - bounceSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
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
        if (chars.power !== null) chars.power += -2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
