export class Statistics {
  constructor(editorModel) {
    this.editorModel = editorModel;
  }

  getLineStats() {
    const lines = this.editorModel.lines;
    let sceneCount = 0;
    let actionLineCount = 0;
    let dialogueLineCount = 0;
    let characterLineCount = 0;

    for (const line of lines) {
      switch (line.type) {
        case "scene_heading":
          sceneCount++;
          break;
        case "action":
          actionLineCount++;
          break;
        case "dialogue":
          dialogueLineCount++;
          break;
        case "character":
          characterLineCount++;
          break;
      }
    }

    return {
      sceneCount,
      actionLineCount,
      dialogueLineCount,
      characterLineCount,
      totalLines: lines.length,
    };
  }

  getWordCount() {
    const lines = this.editorModel.lines;
    let wordCount = 0;

    for (const line of lines) {
      for (const segment of line.segments) {
        if (segment.text) {
          const text = segment.text.trim();
          if (text) {
            wordCount += text.split(/\s+/).length;
          }
        }
      }
    }

    return wordCount;
  }

  getCharacterDialogueCount() {
    const lines = this.editorModel.lines;
    const characterDialogueCount = new Map();
    let currentCharacter = null;

    for (const line of lines) {
      if (line.type === "character") {
        currentCharacter = line.segments
          .map((s) => s.text)
          .join("")
          .trim();
        if (currentCharacter && !characterDialogueCount.has(currentCharacter)) {
          characterDialogueCount.set(currentCharacter, 0);
        }
      } else if (line.type === "dialogue" && currentCharacter) {
        const count = characterDialogueCount.get(currentCharacter);
        characterDialogueCount.set(currentCharacter, count + 1);
      } else if (line.type !== "dialogue" && line.type !== "parenthetical") {
        currentCharacter = null;
      }
    }

    return Object.fromEntries(characterDialogueCount);
  }

  // Assuming 60 lines per page as a rough estimate
  getPageCount() {
    const lines = this.editorModel.lines;
    return Math.ceil(lines.length / 60);
  }

  getAllStats() {
    const lineStats = this.getLineStats();
    const wordCount = this.getWordCount();
    const characterDialogueCount = this.getCharacterDialogueCount();
    const pageCount = this.getPageCount();

    return {
      ...lineStats,
      wordCount,
      characterDialogueCount,
      pageCount,
    };
  }
}
