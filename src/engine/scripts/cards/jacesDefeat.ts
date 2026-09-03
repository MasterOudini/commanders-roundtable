// `Jace's Defeat` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { JACE_S_DEFEAT } from '../../../data/fixtures/engineCards';
import { moveFromStack } from '../../effects';
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

const TEXT = printed(JACE_S_DEFEAT, "Counter target blue spell. If it was a Jace planeswalker spell, scry 2.");

export const JACES_DEFEAT_SCRIPT: CardScript = {
  oracleId: JACE_S_DEFEAT.oracleId,
  name: JACE_S_DEFEAT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      // A script-raised scry/surveil (appendageAmalgam's shape): reveal the top n, then ask.
      const scryEvents = (n: number, toGraveyard: boolean): EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(n, library.length);
        if (count === 0) return [];
        const top = library.slice(library.length - count);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count, toGraveyard, thenDraw: 0, label: "Jace's Defeat" } },
        ];
      };
        { const t = obj.targets[0]; const spell = t && t.kind === 'stack' ? ctx.state.stack.find((o) => o.id === t.id) : undefined;
          if (spell && spell.kind === 'spell') {
            events.push({ t: 'SpellCountered', stackId: spell.id });
            if (spell.card) { const vc = ctx.state.cards[spell.card]; if (vc) events.push(moveFromStack(spell.card, 'graveyard', vc.owner)); }
          } }
        { const t = obj.targets[0]; const spell = t && t.kind === 'stack' ? ctx.state.stack.find((o) => o.id === t.id) : undefined;
          const vc = spell && spell.card ? ctx.state.cards[spell.card] : undefined;
          if (vc && ctx.derive(vc.id).typeLine.subtypes.includes("Jace")) events.push(...scryEvents(2, false));
        }
      return events;
    },
  },
};
