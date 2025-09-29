
import { InsertCharCommand, InsertNewLineCommand, DeleteCharCommand, DeleteSelectionCommand, InsertTextCommand, SetLineTypeCommand, ToggleInlineStyleCommand } from './commands.js';

export class Rebaseable {
  constructor(step, inverted, origin) {
    this.step = step;
    this.inverted = inverted;
    this.origin = origin;
  }
}

export class CollabState {
  constructor(version, unconfirmed, config) {
    this.version = version;
    this.unconfirmed = unconfirmed;
    this.config = config;
  }
}

function unconfirmedFrom(transform) {
  console.log("[collab.js] unconfirmedFrom, transform:", transform);
  let result = [];
  for (let i = 0; i < transform.steps.length; i++) {
    result.push(
      new Rebaseable(
        transform.steps[i],
        transform.steps[i].invert(),
        transform
      )
    );
  }
  console.log("[collab.js] unconfirmedFrom, result:", result);
  return result;
}

export function collab(config = {}) {
  console.log("[collab.js] collab, config:", config);
  const conf = {
    version: config.version || 0,
    clientID:
      config.clientID == null
        ? Math.floor(Math.random() * 0xffffffff)
        : config.clientID,
  };

  return {
    key: "collab",
    state: {
      init: () => new CollabState(conf.version, [], conf),
      apply(tr, collab) {
        console.log("[collab.js] apply, tr:", tr, "collab:", collab);
        let newState = tr.getMeta("collab");
        if (newState) {
            console.log("[collab.js] apply, newState from meta:", newState);
            return newState;
        }
        if (tr.docChanged) {
          const newCollabState = new CollabState(
            collab.version,
            collab.unconfirmed.concat(unconfirmedFrom(tr)),
            collab.config
          );
          console.log("[collab.js] apply, newCollabState:", newCollabState);
          return newCollabState;
        }
        return collab;
      },
    },
    config: conf,
    historyPreserveItems: true,
  };
}



export function receiveTransaction(state, steps, clientIDs, options = {}) {
  console.log("[collab.js] receiveTransaction, state:", state, "steps:", steps, "clientIDs:", clientIDs);
  const collabState = state.collab;
  const version = collabState.version + steps.length;
  const ourID = collabState.config.clientID;

  let ours = 0;
  while (ours < clientIDs.length && clientIDs[ours] == ourID) ++ours;
  let unconfirmed = collabState.unconfirmed.slice(ours);
  steps = ours ? steps.slice(ours) : steps;

  if (!steps.length) {
    const newCollabState = new CollabState(version, unconfirmed, collabState.config);
    console.log("[collab.js] receiveTransaction, no remote steps, newCollabState:", newCollabState);
    return {
      ...state,
      collab: newCollabState,
    };
  }

  const newModel = state.model.clone();
  const originalCursor = newModel.cursor; // Save the original cursor
  console.log("[collab.js] receiveTransaction, newModel:", newModel.getText());

  for (let i = 0; i < unconfirmed.length; i++) {
      try {
        unconfirmed[i].inverted.execute(newModel);
      } catch (e) {
        console.error("Failed to execute inverted unconfirmed step:", unconfirmed[i], e);
      }
  }
  console.log("[collab.js] receiveTransaction, model after reverting local steps:", newModel.getText());

  const deserializedSteps = steps.map(step => stepFromJSON(step));

  for (let i = 0; i < deserializedSteps.length; i++) {
      try {
        if (deserializedSteps[i]) {
            newModel.applyCommand(deserializedSteps[i]);
        }
      } catch (e) {
        console.error("Failed to apply remote step:", deserializedSteps[i], e);
      }
  }
  console.log("[collab.js] receiveTransaction, model after applying remote steps:", newModel.getText());

  newModel.updateCursor(originalCursor); // Restore the original cursor

  if (unconfirmed.length) {
    const rebased = rebaseSteps(unconfirmed, deserializedSteps);
    unconfirmed = rebased.newSteps;
    console.log("[collab.js] receiveTransaction, rebased unconfirmed steps:", unconfirmed);
    for (let i = 0; i < unconfirmed.length; i++) {
        try {
            unconfirmed[i].step.execute(newModel);
        } catch (e) {
            console.error("Failed to execute rebased step:", unconfirmed[i], e);
        }
    }
    console.log("[collab.js] receiveTransaction, model after applying rebased local steps:", newModel.getText());
  }

  const newCollabState = new CollabState(version, unconfirmed, collabState.config);
  console.log("[collab.js] receiveTransaction, final newCollabState:", newCollabState);
  return {
    ...state,
    model: newModel,
    collab: newCollabState,
  };
}

export function sendableSteps(state) {
  console.log("[collab.js] sendableSteps, state:", state);
  const collabState = state.collab;
  if (collabState.unconfirmed.length == 0) return null;
  return {
    version: collabState.version,
    steps: collabState.unconfirmed.map((s) => s.step.toJSON()),
    clientID: collabState.config.clientID,
    get origins() {
      return (
        this._origins ||
        (this._origins = collabState.unconfirmed.map((s) => s.origin))
      );
    },
  };
}

function stepFromJSON(json) {
    if (!json || !json.type) return null;
    switch (json.type) {
        case 'InsertCharCommand':
            return new InsertCharCommand(json.pos, json.char);
        case 'DeleteCharCommand':
            return new DeleteCharCommand(json.pos);
        case 'DeleteSelectionCommand':
            return new DeleteSelectionCommand(json.selection);
        case 'InsertNewLineCommand':
            return new InsertNewLineCommand(json.pos);
        case 'InsertTextCommand':
            return new InsertTextCommand(json.text, json.pos);
        case 'SetLineTypeCommand':
            return new SetLineTypeCommand(json.newType, json.selection, json.cursorLine);
        case 'ToggleInlineStyleCommand':
            return new ToggleInlineStyleCommand(json.style, json.selection);
        default:
            console.error("Unknown step type:", json.type);
            return null;
    }
}

export function getVersion(state) {
  return state.collab.version;
}

class Mapping {
  constructor(commands) {
    this.commands = commands || [];
  }

  map(pos) {
    let newPos = { ...pos };
    for (const command of this.commands) {
      const step = stepFromJSON(command);
      if (step) {
        newPos = step.mapPosition(newPos);
      }
    }
    return newPos;
  }
}

function rebaseSteps(steps, over) {
  const mapping = new Mapping(over);
  const newSteps = [];
  for (let i = 0; i < steps.length; i++) {
      let step = steps[i];
      const mappedCmd = step.step.map(mapping);
      if(mappedCmd) {
        newSteps.push(new Rebaseable(mappedCmd, mappedCmd.invert(), step.origin));
      }
  }
  return { newSteps };
}
