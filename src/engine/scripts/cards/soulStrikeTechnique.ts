// `Soul-Strike Technique` - a static attachedStatic, a enchantedCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_STRIKE_TECHNIQUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_STRIKE_TECHNIQUE, "Enchant creature\nEnchanted creature gets +1/+1 and has vigilance.\nWhen enchanted creature dies, manifest the top card of your library. (Put it onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it's a creature card.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Manifest the top card of your library.", SOUL_STRIKE_TECHNIQUE.name);
const VOCAB_T_L2 = vocabularyTargets("Manifest the top card of your library.");

export const SOUL_STRIKE_TECHNIQUE_SCRIPT: CardScript = {
  oracleId: SOUL_STRIKE_TECHNIQUE.oracleId,
  name: SOUL_STRIKE_TECHNIQUE.name,
  triggers: [
    {
      abilityId: 'enchantedCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === ctx.state.cards[self]?.attachedTo && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Soul-Strike Technique - Manifest the top card of your library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
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
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
