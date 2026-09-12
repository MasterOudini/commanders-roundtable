// `House Guildmage` - an activation vocab, an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOUSE_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOUSE_GUILDMAGE, "{1}{U}, {T}: Target creature doesn't untap during its controller's next untap step.\n{2}{B}, {T}: Surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature doesn't untap during its controller's next untap step.", HOUSE_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature doesn't untap during its controller's next untap step.");

export const HOUSE_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: HOUSE_GUILDMAGE.oracleId,
  name: HOUSE_GUILDMAGE.name,
  activated: [
    {
      ref: `${HOUSE_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${HOUSE_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "House Guildmage - surveil 2" } },
        ];
      },
    },
  ],
};
