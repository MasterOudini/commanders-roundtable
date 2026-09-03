// `Vampiric Spirit` - selfLife on "you lose 4 life": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { VAMPIRIC_SPIRIT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(VAMPIRIC_SPIRIT, "Flying\nWhen this creature enters, you lose 4 life.");
const TEXT = PRINTED.split('\n')[1] as string;

export const VAMPIRIC_SPIRIT_SCRIPT: CardScript = {
  oracleId: VAMPIRIC_SPIRIT.oracleId,
  name: VAMPIRIC_SPIRIT.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => "Vampiric Spirit - you lose 4 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -4, to: me.life + (-4) }];
      },
    },
  ],
};
