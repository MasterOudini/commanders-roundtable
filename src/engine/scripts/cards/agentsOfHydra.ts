// `Agents of HYDRA` — "When this creature dies, create a 2/1 black Villain
// creature token with menace." A dies trigger (Onulet's looksBack shape) whose
// effect is a script-created token (Talrand's resolver rule). M6.4c, D160.

import { AGENTS_OF_HYDRA } from '../../../data/fixtures/engineCards';
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
  AGENTS_OF_HYDRA,
  "When this creature dies, create a 2/1 black Villain creature token with menace. (It can't be blocked except by two or more creatures.)",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const VILLAIN = tokenRef('Villain|2/1|B|Creature|menace');

export const AGENTS_OF_HYDRA_SCRIPT: CardScript = {
  oracleId: AGENTS_OF_HYDRA.oracleId,
  name: AGENTS_OF_HYDRA.name,
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
      label: () => 'Agents of HYDRA — create a 2/1 Villain with menace',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: VILLAIN.oracleId,
          printingId: VILLAIN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
