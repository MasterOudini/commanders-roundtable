// Tier 3 — the manual tools.
//
// ⚠️ These are NOT a back door around the engine. Every one of them goes
// through the same append-only log as an automatic rules action, marked
// `cause.kind === 'manual'` and accompanied by a `ManualAction` record of what
// the player asked for, verbatim. That is what keeps replay, rewind and
// reconnect working across a game that used them — and in a friends game it is
// a trust feature, because the log always shows what was automated and what was
// hand-waved.
//
// ⚠️ They enforce almost nothing, on purpose. The engine deliberately does not
// know what a card does (see AGENTS.md's tier table), so a tool that second-
// guessed the player would be wrong more often than the player is.

import { derive } from './derive';
import { effectResult } from './effects';
import { faceOf } from './oracle';
import { shuffle } from './rng';
import { n, narrated, ref, themself, their, vb, who, whoElse, whoseElse } from './narrate';
import type { EngineDeps } from './loop';
import type { CardMove, EventBody } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import { poolFrom } from './types/mana';
import { accept, reject, type HandleResult, type Intent } from './types/intents';
import type { GameState } from './types/state';

type ManualIntent = Extract<Intent, { t: `Manual${string}` }>;

export function manualIntent(state: GameState, intent: Intent, deps: EngineDeps): HandleResult {
  if (!intent.t.startsWith('Manual')) {
    return reject('unknownIntent', `The engine does not know how to handle "${intent.t}".`);
  }
  return runManual(state, intent as ManualIntent, deps);
}

function nameOf(state: GameState, deps: EngineDeps, id: InstanceId): string {
  const card = state.cards[id];
  if (!card) return 'a card';
  const d = derive(state, deps.oracle, deps.scripts, id);
  if (d.name) return d.name;
  const oracleCard = deps.oracle.byPrinting(card.printingId);
  return oracleCard ? faceOf(oracleCard, card.faceIndex).name : 'a card';
}

function identityOf(state: GameState, deps: EngineDeps, id: InstanceId) {
  const card = state.cards[id];
  if (!card) return [];
  return deps.oracle.byPrinting(card.printingId)?.colorIdentity ?? [];
}

function marker(player: PlayerId, tool: string, detail: string): EventBody {
  return { t: 'ManualAction', player, tool, detail };
}

function runManual(state: GameState, intent: ManualIntent, deps: EngineDeps): HandleResult {
  const actor = intent.player;
  // ⚠️ A PART, not a name string, so every tool's line can be read in the second
  // person by the player who used it. Every verb beside it needs its own `vb`.
  const me = who(state, actor);

  switch (intent.t) {
    case 'ManualMoveCard': {
      const card = state.cards[intent.card];
      if (!card) return reject('noSuchCard', 'That card is not in the game.');
      const to: ZoneRef = { kind: intent.to.kind, player: intent.to.player };
      const move: CardMove = {
        card: intent.card,
        from: card.zone,
        to,
        ...(intent.placement !== undefined ? { placement: intent.placement } : {}),
        ...(intent.faceDown !== undefined ? { faceDown: intent.faceDown } : {}),
      };
      const name = nameOf(state, deps, intent.card);
      return accept([
        marker(actor, 'moveCard', `${intent.card} → ${to.kind}:${to.player}`),
        { t: 'CardsMoved', moves: [move] },
        narrated(
          n`${me} ${vb(actor, 'moves', 'move')} ${name} to ${zoneWord(to.kind)}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }

    case 'ManualCreateToken': {
      const printing = deps.oracle.byPrinting(intent.printingId);
      if (!printing) return reject('noSuchToken', 'That token is not in the card database.');
      if (intent.count < 1 || intent.count > 100) {
        return reject('invalidAmount', 'Create between 1 and 100 tokens.');
      }
      const events: EventBody[] = [marker(actor, 'createToken', `${intent.count} × ${printing.name}`)];
      for (let i = 0; i < intent.count; i++) {
        events.push({
          t: 'TokenCreated',
          card: `c${state.counters.instance + i + 1}`,
          oracleId: printing.oracleId,
          printingId: printing.printingId,
          controller: actor,
          owner: actor,
          turnNumber: state.turn.turnNumber,
        });
      }
      events.push(
        narrated(
          n`${me} ${vb(actor, 'creates', 'create')} ${intent.count} ${printing.name} token${intent.count === 1 ? '' : 's'}.`,
          actor,
          printing.colorIdentity,
          true,
        ),
      );
      return accept(events);
    }

    case 'ManualSetCounter': {
      if (!state.cards[intent.card]) return reject('noSuchCard', 'That card is not in the game.');
      if (intent.delta === 0) return reject('invalidAmount', 'Choose how many counters to add or remove.');
      const name = nameOf(state, deps, intent.card);
      return accept([
        marker(actor, 'counter', `${intent.card} ${intent.kind} ${intent.delta > 0 ? '+' : ''}${intent.delta}`),
        { t: 'CountersChanged', changes: [{ card: intent.card, kind: intent.kind, delta: intent.delta }] },
        narrated(
          n`${me} ${intent.delta > 0 ? vb(actor, 'adds', 'add') : vb(actor, 'removes', 'remove')} ${Math.abs(intent.delta)} ${intent.kind} counter${Math.abs(intent.delta) === 1 ? '' : 's'} ${intent.delta > 0 ? 'to' : 'from'} ${name}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }

    case 'ManualSetLife': {
      const target = state.players[intent.target];
      if (!target) return reject('noSuchPlayer', 'That player is not in this game.');
      return accept([
        marker(actor, 'life', `${intent.target} ${intent.delta > 0 ? '+' : ''}${intent.delta}`),
        { t: 'LifeChanged', player: intent.target, delta: intent.delta, to: target.life + intent.delta },
        narrated(
          n`${me} ${vb(actor, 'sets', 'set')} ${whoElse(state, actor, intent.target)} to ${target.life + intent.delta} life.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualSetPoison': {
      const target = state.players[intent.target];
      if (!target) return reject('noSuchPlayer', 'That player is not in this game.');
      const to = Math.max(0, target.poison + intent.delta);
      return accept([
        marker(actor, 'poison', `${intent.target} ${intent.delta > 0 ? '+' : ''}${intent.delta}`),
        { t: 'PoisonChanged', player: intent.target, delta: intent.delta, to },
        narrated(
          n`${me} ${vb(actor, 'sets', 'set')} ${whoElse(state, actor, intent.target)} to ${to} poison.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualAddMana': {
      if (!state.players[intent.target]) return reject('noSuchPlayer', 'That player is not in this game.');
      if (intent.amount < 1 || intent.amount > 100) {
        return reject('invalidAmount', 'Add between 1 and 100 mana.');
      }
      return accept([
        marker(actor, 'addMana', `${intent.target} +${intent.amount}{${intent.symbol}}`),
        {
          t: 'ManaAdded',
          player: intent.target,
          mana: poolFrom({ [intent.symbol]: intent.amount }),
          source: null,
        },
        narrated(
          n`${me} ${vb(actor, 'adds', 'add')} ${intent.amount}{${intent.symbol}} to ${whoseElse(state, actor, intent.target)} pool.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualEmptyPool': {
      const target = state.players[intent.target];
      if (!target) return reject('noSuchPlayer', 'That player is not in this game.');
      return accept([
        marker(actor, 'emptyPool', intent.target),
        { t: 'ManaPoolEmptied', player: intent.target, lost: target.pool },
        narrated(
          n`${me} ${vb(actor, 'empties', 'empty')} ${whoseElse(state, actor, intent.target)} mana pool.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualSetTapped': {
      const cards = intent.cards.filter((id) => state.cards[id]);
      if (cards.length === 0) return reject('noSuchCard', 'None of those cards are in the game.');
      return accept([
        marker(actor, intent.tapped ? 'tap' : 'untap', cards.join(',')),
        intent.tapped ? { t: 'PermanentsTapped', cards } : { t: 'PermanentsUntapped', cards },
        narrated(
          n`${me} ${intent.tapped ? vb(actor, 'taps', 'tap') : vb(actor, 'untaps', 'untap')} ${cards.length === 1 ? nameOf(state, deps, cards[0] as InstanceId) : `${cards.length} permanents`}.`,
          actor,
          cards.length === 1 ? identityOf(state, deps, cards[0] as InstanceId) : [],
          true,
        ),
      ]);
    }

    case 'ManualSetFaceDown': {
      if (!state.cards[intent.card]) return reject('noSuchCard', 'That card is not in the game.');
      return accept([
        marker(actor, 'faceDown', `${intent.card} ${intent.faceDown}`),
        { t: 'FaceDownSet', card: intent.card, faceDown: intent.faceDown },
        narrated(
          n`${me} ${vb(actor, 'turns', 'turn')} a permanent face ${intent.faceDown ? 'down' : 'up'}.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualFlipFace': {
      const card = state.cards[intent.card];
      if (!card) return reject('noSuchCard', 'That card is not in the game.');
      const oracleCard = deps.oracle.byPrinting(card.printingId);
      const faces = oracleCard?.faces.length ?? 1;
      if (faces < 2) return reject('noSuchCard', 'That card has only one face.');
      const next = (card.faceIndex + 1) % faces;
      return accept([
        marker(actor, 'flipFace', `${intent.card} → face ${next}`),
        { t: 'FaceIndexSet', card: intent.card, faceIndex: next },
        narrated(
          n`${me} ${vb(actor, 'transforms', 'transform')} ${nameOf(state, deps, intent.card)}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }

    case 'ManualSetPt': {
      if (!state.cards[intent.card]) return reject('noSuchCard', 'That card is not in the game.');
      const override =
        intent.power === null || intent.toughness === null
          ? null
          : { power: intent.power, toughness: intent.toughness };
      return accept([
        marker(actor, 'setPt', `${intent.card} ${intent.power}/${intent.toughness}`),
        { t: 'PtOverrideSet', card: intent.card, override },
        narrated(
          override
            ? n`${me} ${vb(actor, 'sets', 'set')} ${nameOf(state, deps, intent.card)} to ${override.power}/${override.toughness}.`
            : n`${me} ${vb(actor, 'clears', 'clear')} the power/toughness override on ${nameOf(state, deps, intent.card)}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }

    case 'ManualAttach': {
      if (!state.cards[intent.card]) return reject('noSuchCard', 'That card is not in the game.');
      if (intent.to !== null && !state.cards[intent.to]) {
        return reject('noSuchCard', 'That host is not in the game.');
      }
      if (intent.to === intent.card) return reject('noSuchCard', 'A permanent cannot be attached to itself.');
      return accept([
        marker(actor, 'attach', `${intent.card} → ${intent.to ?? 'nothing'}`),
        { t: 'AttachmentChanged', card: intent.card, to: intent.to },
        narrated(
          intent.to
            ? n`${me} ${vb(actor, 'attaches', 'attach')} ${nameOf(state, deps, intent.card)} to ${nameOf(state, deps, intent.to)}.`
            : n`${me} ${vb(actor, 'unattaches', 'unattach')} ${nameOf(state, deps, intent.card)}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }

    case 'ManualSetController': {
      if (!state.cards[intent.card]) return reject('noSuchCard', 'That card is not in the game.');
      if (!state.players[intent.controller]) return reject('noSuchPlayer', 'That player is not in this game.');
      return accept([
        marker(actor, 'setController', `${intent.card} → ${intent.controller}`),
        { t: 'ControlChanged', card: intent.card, controller: intent.controller },
        narrated(
          n`${me} ${vb(actor, 'gives', 'give')} control of ${nameOf(state, deps, intent.card)} to ${whoElse(state, actor, intent.controller)}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }

    case 'ManualReveal': {
      const cards = intent.cards.filter((id) => state.cards[id]);
      if (cards.length === 0) return reject('noSuchCard', 'None of those cards are in the game.');
      const to = intent.toAll ? state.seating : [actor];
      return accept([
        marker(actor, 'reveal', cards.join(',')),
        { t: 'CardsRevealed', cards, to },
        narrated(
          intent.toAll
            ? n`${me} ${vb(actor, 'reveals', 'reveal')} ${cards.length} card${cards.length === 1 ? '' : 's'}.`
            : n`${me} ${vb(actor, 'reveals', 'reveal')} ${cards.length} card${cards.length === 1 ? '' : 's'} to ${themself(actor)}.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualPeekLibrary': {
      const library = state.zones.library[actor] ?? [];
      if (intent.count < 1) return reject('invalidAmount', 'Look at at least one card.');
      const top = library.slice(Math.max(0, library.length - intent.count));
      if (top.length === 0) return reject('invalidAmount', 'Your library is empty.');
      return accept([
        marker(actor, 'peekLibrary', String(intent.count)),
        // ⚠️ Revealed to the PEEKER only. `redactEvent` strips the ids for
        // everyone else, so the narration says how many, never which.
        { t: 'CardsRevealed', cards: top, to: [actor] },
        narrated(
          n`${me} ${vb(actor, 'looks', 'look')} at the top ${top.length} card${top.length === 1 ? '' : 's'} of ${their(actor)} library.`,
          actor,
          [],
          true,
        ),
      ]);
    }

    case 'ManualStopPeeking': {
      const library = state.zones.library[actor] ?? [];
      const looking = library.filter((id) => state.cards[id]?.revealedTo.includes(actor));
      // ⚠️ Not a rejection. "Stop looking" when nothing is revealed is the
      // natural end of a scry that put every card somewhere else, and the UI
      // sends it either way rather than deciding whether the engine will want it.
      if (looking.length === 0) return accept([]);
      return accept([{ t: 'RevealCleared', cards: looking }]);
    }

    case 'ManualMoveTopOfLibrary': {
      const library = state.zones.library[intent.target] ?? [];
      if (intent.count < 1 || intent.count > 100) {
        return reject('invalidAmount', 'Move between 1 and 100 cards.');
      }
      const take = Math.min(intent.count, library.length);
      if (take === 0) return reject('invalidAmount', 'That library is empty.');
      // ⚠️ TOP FIRST. The library array is bottom-first, so the top `take` cards
      // are its last entries, and reversing them means the card that was on top
      // is the one that arrives first — which is the order a graveyard shows.
      const ids = library.slice(library.length - take).reverse();
      const to = intent.to;
      return accept([
        marker(actor, to === 'graveyard' ? 'mill' : 'exileTop', `${intent.target} ×${take}`),
        {
          t: 'CardsMoved',
          moves: ids.map((card) => ({
            card,
            from: { kind: 'library' as const, player: intent.target },
            to: { kind: to, player: intent.target },
          })),
        },
        narrated(
          to === 'graveyard'
            ? n`${who(state, intent.target)} ${vb(intent.target, 'mills', 'mill')} ${take} card${take === 1 ? '' : 's'}.`
            : n`${who(state, intent.target)} ${vb(intent.target, 'exiles', 'exile')} the top ${take} card${take === 1 ? '' : 's'} of ${their(intent.target)} library.`,
          intent.target,
          [],
          true,
        ),
      ]);
    }

    case 'ManualMoveZone': {
      const pile = intent.from === 'graveyard'
        ? (state.zones.graveyard[intent.target] ?? [])
        : (state.zones.exile[intent.target] ?? []);
      // ⚠️ NOT `zoneWord`: it returns "the graveyard", and these sentences put a
      // possessive in front of it — "your the graveyard".
      const pileWord = intent.from === 'graveyard' ? 'graveyard' : 'exile';
      if (pile.length === 0) return reject('invalidAmount', `That ${pileWord} is empty.`);
      const events: EventBody[] = [
        marker(actor, 'moveZone', `${intent.target} ${intent.from}→${intent.to}`),
        {
          t: 'CardsMoved',
          moves: pile.map((card) => ({
            card,
            from: { kind: intent.from, player: intent.target },
            to: { kind: intent.to, player: intent.target },
          })),
        },
      ];
      // ⚠️ The shuffled `order` must be a permutation of the library AFTER the
      // cards arrive, because `LibraryShuffled` SETS the zone rather than
      // permuting it. Shuffling the library as it stands now would drop every
      // card this intent is moving into it.
      let next = state.rng;
      if (intent.to === 'library' && intent.shuffle) {
        const resulting = [...(state.zones.library[intent.target] ?? []), ...pile];
        const shuffled = shuffle(state.rng, resulting);
        events.push({ t: 'LibraryShuffled', player: intent.target, order: shuffled.value });
        next = shuffled.next;
      }
      const count = pile.length;
      events.push(
        narrated(
          intent.to === 'library'
            ? n`${me} ${vb(actor, 'shuffles', 'shuffle')} ${whoseElse(state, actor, intent.target)} ${pileWord} into ${their(intent.target)} library.`
            : n`${me} ${vb(actor, 'exiles', 'exile')} ${whoseElse(state, actor, intent.target)} ${pileWord} — ${count} card${count === 1 ? '' : 's'}.`,
          actor,
          [],
          true,
        ),
      );
      return accept(events, next);
    }

    case 'ManualDraw': {
      const library = state.zones.library[intent.target] ?? [];
      if (intent.count < 1 || intent.count > 100) return reject('invalidAmount', 'Draw between 1 and 100 cards.');
      const take = Math.min(intent.count, library.length);
      const events: EventBody[] = [marker(actor, 'draw', `${intent.target} ×${intent.count}`)];
      if (take > 0) {
        const ids = library.slice(library.length - take).reverse();
        events.push({
          t: 'CardsMoved',
          moves: ids.map((card) => ({
            card,
            from: { kind: 'library' as const, player: intent.target },
            to: { kind: 'hand' as const, player: intent.target },
          })),
        });
      }
      if (take < intent.count) events.push({ t: 'DrewFromEmptyLibrary', player: intent.target });
      events.push(
        // ⚠️ The SUBJECT is whoever drew, not whoever pressed the button (D100),
        // so both the name and the verb agree with `intent.target`.
        narrated(
          n`${who(state, intent.target)} ${vb(intent.target, 'draws', 'draw')} ${take} card${take === 1 ? '' : 's'}.`,
          intent.target,
          [],
          true,
        ),
      );
      return accept(events);
    }

    case 'ManualShuffle': {
      const library = state.zones.library[intent.target] ?? [];
      const shuffled = shuffle(state.rng, library);
      return accept(
        [
          marker(actor, 'shuffle', intent.target),
          { t: 'LibraryShuffled', player: intent.target, order: shuffled.value },
          narrated(
            n`${me} ${vb(actor, 'shuffles', 'shuffle')} ${whoseElse(state, actor, intent.target)} library.`,
            actor,
            [],
            true,
          ),
        ],
        shuffled.next,
      );
    }

    /**
     * ⚠️ Runs the SAME `effectEvents` the automatic path runs — there is no
     * second implementation of "deal 3 damage", so the assisted outcome and the
     * automatic one cannot drift. What differs is only WHO decided: the engine
     * refuses to act on a partly-understood card, and this is the player saying
     * "apply the part you did understand". Hence the wrench in the log.
     */
    case 'ManualApplyEffect': {
      const card = state.cards[intent.card];
      if (!card) return reject('noSuchCard', 'That card is not in the game.');
      const oracleCard = deps.oracle.byPrinting(card.printingId);
      const face = oracleCard ? faceOf(oracleCard, card.faceIndex) : null;
      if (!face || face.effectMode !== 'assisted' || face.effects.length === 0) {
        return reject('notCastable', 'There is nothing on that card for the app to apply.');
      }
      // A synthetic stack object: the card has already left the stack, but the
      // effects still need a source and the targets the player aimed at.
      const obj = {
        id: 's0',
        kind: 'spell' as const,
        controller: intent.player,
        card: intent.card,
        source: null,
        abilityRef: null,
        // The card's own face — this is the ASSISTED offer for a spell that has
        // already resolved, so whatever face it was cast as is on the instance.
        faceIndex: card.faceIndex,
        targets: intent.targets,
        modes: [],
        xValue: null,
        label: face.name,
        identity: oracleCard?.colorIdentity ?? [],
        taxApplied: 0,
        isCommanderCast: false,
        castFrom: null,
      };
      // ⚠️ `effectResult`, so the RNG is threaded here TOO. This path is the
      // ASSISTED offer, which by definition runs a card the parser understood
      // only in part — so a card with an at-random clause AND an unread one
      // arrives here rather than resolving on its own, and dropping the advance
      // would make exactly those cards replay to a different board.
      const { events, rng } = effectResult(state, deps, obj, face.effects);
      if (events.length === 0) {
        return reject('illegalTarget', 'Those targets are gone — apply the rest of the card by hand.');
      }
      return accept([
        marker(actor, 'applyEffect', `${intent.card} ×${face.effects.length}`),
        ...events,
        narrated(
          // `ref` rather than `vb` — "theirs" is a possessive, not a verb.
          n`${me} ${vb(actor, 'applies', 'apply')} the part of ${face.name} the app understands. The rest is ${ref(actor, 'theirs', 'yours')}.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ], rng);
    }

    case 'ManualSetCommander': {
      const card = state.cards[intent.card];
      if (!card) return reject('noSuchCard', 'That card is not in the game.');
      return accept([
        marker(actor, 'setCommander', `${intent.card} ${intent.isCommander}`),
        { t: 'CommanderFlagSet', card: intent.card, isCommander: intent.isCommander },
        narrated(
          intent.isCommander
            ? n`${me} ${vb(actor, 'makes', 'make')} ${nameOf(state, deps, intent.card)} a commander.`
            : n`${me} ${vb(actor, 'stops', 'stop')} treating ${nameOf(state, deps, intent.card)} as a commander.`,
          actor,
          identityOf(state, deps, intent.card),
          true,
        ),
      ]);
    }
  }
}

function zoneWord(kind: ZoneRef['kind']): string {
  switch (kind) {
    case 'battlefield':
      return 'the battlefield';
    case 'graveyard':
      return 'the graveyard';
    case 'command':
      return 'the command zone';
    case 'library':
      return 'their library';
    case 'hand':
      return 'their hand';
    case 'exile':
      return 'exile';
    case 'stack':
      return 'the stack';
  }
}
