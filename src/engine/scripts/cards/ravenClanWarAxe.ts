// `Raven Clan War-Axe` - a etb trigger vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVEN_CLAN_WAR_AXE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVEN_CLAN_WAR_AXE, "When this Equipment enters, you may search your library and/or graveyard for a card named Eivor, Battle-Ready, reveal it, and put it into your hand. If you search your library this way, shuffle.\nEquipped creature gets +2/+0 and has trample.\nEquip {2}");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library and/or graveyard for a card named Eivor, Battle-Ready, reveal it, and put it into your hand. If you search your library this way, shuffle.", RAVEN_CLAN_WAR_AXE.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library and/or graveyard for a card named Eivor, Battle-Ready, reveal it, and put it into your hand. If you search your library this way, shuffle.");

export const RAVEN_CLAN_WAR_AXE_SCRIPT: CardScript = {
  oracleId: RAVEN_CLAN_WAR_AXE.oracleId,
  name: RAVEN_CLAN_WAR_AXE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Raven Clan War-Axe - Search your library and/or graveyard for a card named Eivor, Battle-Ready, reveal it, and put it into your hand. If you search your library this way, shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
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
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
