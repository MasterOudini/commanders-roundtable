// `Gideon's Resolve` - a etb trigger vocab, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIDEON_S_RESOLVE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(GIDEON_S_RESOLVE, "When this enchantment enters, you may search your library and/or graveyard for a card named Gideon, Martial Paragon, reveal it, and put it into your hand. If you search your library this way, shuffle.\nCreatures you control get +1/+1.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library and/or graveyard for a card named Gideon, Martial Paragon, reveal it, and put it into your hand. If you search your library this way, shuffle.", GIDEON_S_RESOLVE.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library and/or graveyard for a card named Gideon, Martial Paragon, reveal it, and put it into your hand. If you search your library this way, shuffle.");

export const GIDEONS_RESOLVE_SCRIPT: CardScript = {
  oracleId: GIDEON_S_RESOLVE.oracleId,
  name: GIDEON_S_RESOLVE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gideon's Resolve - Search your library and/or graveyard for a card named Gideon, Martial Paragon, reveal it, and put it into your hand. If you search your library this way, shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
