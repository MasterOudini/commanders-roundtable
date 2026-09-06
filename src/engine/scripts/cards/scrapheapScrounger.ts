// `Scrapheap Scrounger` - a static cantBlock, an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCRAPHEAP_SCROUNGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCRAPHEAP_SCROUNGER, "This creature can't block.\n{1}{B}, Exile another creature card from your graveyard: Return this card from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

export const SCRAPHEAP_SCROUNGER_SCRIPT: CardScript = {
  oracleId: SCRAPHEAP_SCROUNGER.oracleId,
  name: SCRAPHEAP_SCROUNGER.name,
  activated: [
    {
      ref: `${SCRAPHEAP_SCROUNGER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
