// `Declaration in Stone` — "Exile target creature and all other creatures
// its controller controls with the same name as that creature. That player
// investigates for each nontoken creature exiled this way." The same-name
// family is matched by ORACLE NAME over the target's controller's board;
// the Clues go to THAT PLAYER, one per nontoken exiled. D207.

import { DECLARATION_IN_STONE } from '../../../data/fixtures/engineCards';
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
  DECLARATION_IN_STONE,
  'Exile target creature and all other creatures its controller controls with the same name as that creature. That player investigates for each nontoken creature exiled this way.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const DECLARATION_IN_STONE_SCRIPT: CardScript = {
  oracleId: DECLARATION_IN_STONE.oracleId,
  name: DECLARATION_IN_STONE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const owner = victim.controller;
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const moves = [];
      let nontoken = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== owner) continue;
        const isTarget = id === target.id;
        if (!isTarget) {
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        }
        if (!card.isToken) nontoken++;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      const events: EventBody[] = [{ t: 'CardsMoved', moves }];
      for (let i = 0; i < nontoken; i++) {
        events.push({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CLUE.oracleId,
          printingId: CLUE.printingId,
          controller: owner,
          owner,
          turnNumber: ctx.state.turn.turnNumber,
        });
      }
      return events;
    },
  },
};
