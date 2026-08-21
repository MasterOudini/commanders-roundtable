// `Symbiotic Wurm` — SEVEN Insects on one death, each a distinct instance
// through D164's advancing allocator. The largest single token drop of the
// arc; Beast (four) and Elf (two) are the same shape at other sizes. D256.

import { SYMBIOTIC_WURM } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  SYMBIOTIC_WURM,
  'When this creature dies, create seven 1/1 green Insect creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const INSECT = tokenRef('Insect|1/1|G|Creature|');

export const SYMBIOTIC_WURM_SCRIPT: CardScript = {
  oracleId: SYMBIOTIC_WURM.oracleId,
  name: SYMBIOTIC_WURM.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Symbiotic Wurm — create seven 1/1 Insects',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const events: EventBody[] = [];
        for (let i = 0; i < 7; i++) {
          events.push({
            t: 'TokenCreated',
            card: ctx.ids.nextInstance(),
            oracleId: INSECT.oracleId,
            printingId: INSECT.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          });
        }
        return events;
      },
    },
  ],
};
