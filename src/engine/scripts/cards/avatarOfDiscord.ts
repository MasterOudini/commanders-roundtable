// `Avatar of Discord` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVATAR_OF_DISCORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVATAR_OF_DISCORD, "({B/R} can be paid with either {B} or {R}.)\nFlying\nWhen this creature enters, sacrifice it unless you discard two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Sacrifice it unless you discard two cards.", AVATAR_OF_DISCORD.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice it unless you discard two cards.");

export const AVATAR_OF_DISCORD_SCRIPT: CardScript = {
  oracleId: AVATAR_OF_DISCORD.oracleId,
  name: AVATAR_OF_DISCORD.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Avatar of Discord - Sacrifice it unless you discard two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
