// `Tidy Conclusion` — destroy plus an artifact census. The gain is NOT tied
// to the destruction (unlike Terashi's Grasp, D258): the card says "you gain
// 1 life for each artifact you control" as its own sentence, so an
// indestructible victim surviving still pays the life. D260.

import { TIDY_CONCLUSION } from '../../../data/fixtures/engineCards';
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
  TIDY_CONCLUSION,
  'Destroy target creature. You gain 1 life for each artifact you control.',
);

export const TIDY_CONCLUSION_SCRIPT: CardScript = {
  oracleId: TIDY_CONCLUSION.oracleId,
  name: TIDY_CONCLUSION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      // ⚠️ The census is the SECOND sentence, so it reads the board the first
      // one left behind: an artifact creature of mine that just died to this
      // very spell is already gone and must not be counted. `ctx.state` is
      // the pre-resolution state, so the destroyed card is skipped by hand.
      const destroyed = events.length > 0 ? target.id : null;
      let artifacts = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller || id === destroyed) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) artifacts += 1;
      }
      if (artifacts === 0) return events;
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: artifacts,
          to: me.life + artifacts,
        });
      }
      return events;
    },
  },
};
