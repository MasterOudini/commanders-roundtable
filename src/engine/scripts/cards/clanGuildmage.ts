// `Clan Guildmage` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLAN_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLAN_GUILDMAGE, "{1}{R}, {T}: Target creature can't block this turn.\n{2}{G}, {T}: Target land you control becomes a 4/4 Elemental creature with haste until end of turn. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", CLAN_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");
const VOCAB_A1 = vocabularyEffects("Target land you control becomes a 4/4 Elemental creature with haste until end of turn. It's still a land.", CLAN_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Target land you control becomes a 4/4 Elemental creature with haste until end of turn. It's still a land.");

export const CLAN_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: CLAN_GUILDMAGE.oracleId,
  name: CLAN_GUILDMAGE.name,
  activated: [
    {
      ref: `${CLAN_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${CLAN_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
