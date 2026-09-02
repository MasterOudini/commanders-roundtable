// `Prizefight` — "Target creature you control fights target creature you
// don't control. (reminder)\nCreate a Treasure token. (reminder)" Swift
// Kick's fight (D255: the two creatures read BY CONTROLLER, never by index;
// each deals its derived power to the other in one DamageDealt) and then a
// Treasure — which comes even when one fighter has left, because a spell
// with one legal target still resolves (CR 608.2b), and the Treasure asks
// nothing of the targets. D279.

import { PRIZEFIGHT } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  PRIZEFIGHT,
  'Target creature you control fights target creature you don\'t control. (Each deals damage equal to its power to the other.)\nCreate a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const PRIZEFIGHT_SCRIPT: CardScript = {
  oracleId: PRIZEFIGHT.oracleId,
  name: PRIZEFIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let mine: InstanceId | null = null;
      let theirs: InstanceId | null = null;
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.controller === obj.controller) mine ??= target.id;
        else theirs ??= target.id;
      }
      const events: EventBody[] = [];
      if (mine !== null && theirs !== null) {
        const a = ctx.derive(mine);
        const b = ctx.derive(theirs);
        const theirController = ctx.state.cards[theirs]?.controller;
        const damages = [];
        if ((a.power ?? 0) > 0) {
          damages.push({
            source: mine,
            target: { kind: 'card' as const, id: theirs },
            amount: a.power ?? 0,
            deathtouch: a.keywords.has('deathtouch'),
            lifelinkTo: a.keywords.has('lifelink') ? obj.controller : null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: a.keywords.has('infect') || a.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
          });
        }
        if ((b.power ?? 0) > 0) {
          damages.push({
            source: theirs,
            target: { kind: 'card' as const, id: mine },
            amount: b.power ?? 0,
            deathtouch: b.keywords.has('deathtouch'),
            lifelinkTo: b.keywords.has('lifelink') && theirController ? theirController : null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: b.keywords.has('infect') || b.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
          });
        }
        if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      }
      events.push({
        t: 'TokenCreated',
        card: ctx.ids.nextInstance(),
        oracleId: TREASURE.oracleId,
        printingId: TREASURE.printingId,
        controller: obj.controller,
        owner: obj.controller,
        turnNumber: ctx.state.turn.turnNumber,
      });
      return events;
    },
  },
};
