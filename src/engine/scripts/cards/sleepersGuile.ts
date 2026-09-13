// `Sleeper's Guile` - a static attachedStatic, a auraToGraveyard trigger bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLEEPER_S_GUILE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLEEPER_S_GUILE, "Enchant creature\nEnchanted creature has fear. (It can't be blocked except by artifact creatures and/or black creatures.)\nWhen this Aura is put into a graveyard from the battlefield, return it to its owner's hand.");
const LINES = PRINTED.split('\n');

export const SLEEPERS_GUILE_SCRIPT: CardScript = {
  oracleId: SLEEPER_S_GUILE.oracleId,
  name: SLEEPER_S_GUILE.name,
  triggers: [
    {
      abilityId: 'auraToGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Sleeper's Guile - bounceSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("fear");
      },
    },
  ],
};
