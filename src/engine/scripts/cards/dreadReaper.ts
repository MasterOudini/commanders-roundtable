// `Dread Reaper` - selfLife on "you lose 5 life": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { DREAD_REAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAD_REAPER, "Flying\nWhen this creature enters, you lose 5 life.");
const TEXT = PRINTED.split('\n')[1] as string;

export const DREAD_REAPER_SCRIPT: CardScript = {
  oracleId: DREAD_REAPER.oracleId,
  name: DREAD_REAPER.name,
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
      label: () => "Dread Reaper - you lose 5 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -5, to: me.life + (-5) }];
      },
    },
  ],
};
