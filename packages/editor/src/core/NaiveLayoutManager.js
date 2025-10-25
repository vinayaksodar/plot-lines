class NaiveLayoutManager {
  static DPI = 96;
  static PAGE_CONTENT_HEIGHT_PX = 9 * NaiveLayoutManager.DPI; // 9"
  static PAGE_BREAK_HEIGHT_PX = 2 * NaiveLayoutManager.DPI; // 2"

  constructor(getLineHeightFn, getNumLinesFn, getTopSpacingFn, getLineTypeFn) {
    this.getLineHeight = getLineHeightFn;
    this.getNumLines = getNumLinesFn;
    this.getTopSpacing = getTopSpacingFn;
    this.getLineType = getLineTypeFn;
  }

  getOrphanGroup(page) {
    if (page.lines.length === 0) return null;

    const lastLine = page.lines[page.lines.length - 1];
    const lastIdx = lastLine.index;
    const lastType = this.getLineType(lastIdx);

    const remainingSpace =
      NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX - page.contentHeight;

    // --- Rule A: character + parenthetical must stay together
    if (
      lastType === "parenthetical" &&
      page.lines.length >= 2 &&
      this.getLineType(page.lines[page.lines.length - 2].index) === "character"
    ) {
      const nextIdx = lastIdx + 1;
      if (nextIdx < this.getNumLines()) {
        const nextHeight = this.getLineHeight(nextIdx);
        if (remainingSpace < nextHeight) {
          return [
            page.lines[page.lines.length - 2], // character
            lastLine, // parenthetical
          ];
        }
      }
      const required = this.getLineHeight(lastIdx);
      if (remainingSpace < required) {
        return [
          page.lines[page.lines.length - 2], // character
          lastLine, // parenthetical
        ];
      }
    }

    // --- Rule B: character rules
    if (lastType === "character") {
      // Special case: character + dialogue must stay together
      const nextIdx = lastIdx + 1;
      if (
        nextIdx < this.getNumLines() &&
        this.getLineType(nextIdx) === "dialogue"
      ) {
        const nextHeight = this.getLineHeight(nextIdx);
        if (remainingSpace < nextHeight) {
          return [lastLine]; // mark character as orphan → move with dialogue next page
        }
      }
      const required = this.getLineHeight(lastIdx);
      if (remainingSpace < required) {
        return [lastLine];
      }
    }

    // --- Rule C: scene-heading rules
    if (lastType === "scene-heading") {
      const nextIdx = lastIdx + 1;
      if (nextIdx < this.getNumLines()) {
        return [lastLine];
      }

      const required = 2 * this.getLineHeight(lastIdx);
      if (remainingSpace < required) {
        return [lastLine];
      }
    }

    return null;
  }

  /**
   * Returns an array of page objects:
   * [
   *   {
   *     startLine,
   *     endLine,
   *     contentHeight,    // sum of line heights + top spacings for that page
   *     lines: [ { index, topSpacing, height }, ... ]
   *   },
   *   ...
   * ]
   */
  getPageLineRanges() {
    const pageLineRanges = [];
    const numLines = this.getNumLines();
    let currentLine = 0;

    while (currentLine < numLines) {
      const startLine = currentLine;
      let accumulatedHeight = 0;
      let line = currentLine;

      const page = {
        startLine,
        endLine: startLine,
        contentHeight: 0,
        lines: [],
      };

      while (line < numLines) {
        const isFirstOnPage = line === startLine;
        const spacing = this.getTopSpacing
          ? this.getTopSpacing(line, isFirstOnPage)
          : 0;
        const baseHeight = this.getLineHeight(line);
        const h = spacing + baseHeight;

        if (
          accumulatedHeight + h > NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX &&
          accumulatedHeight > 0
        ) {
          break;
        }

        page.lines.push({ index: line, topSpacing: spacing, height: h });
        accumulatedHeight += h;
        page.endLine = line;

        line++;

        if (
          h > NaiveLayoutManager.PAGE_CONTENT_HEIGHT_PX &&
          accumulatedHeight > 0
        ) {
          break;
        }
      }

      page.contentHeight = accumulatedHeight;

      // --- Orphan fix ---
      const orphanGroup = this.getOrphanGroup(page);
      if (orphanGroup) {
        // Pop each line in group (from last to first)
        for (let i = orphanGroup.length - 1; i >= 0; i--) {
          const orphan = page.lines.pop();
          accumulatedHeight -= orphan.height;
        }

        // Update page end markers
        page.endLine =
          page.lines.length > 0
            ? page.lines[page.lines.length - 1].index
            : page.startLine;
        page.contentHeight = accumulatedHeight;

        // Put group back for next page
        line = orphanGroup[0].index;
      }

      pageLineRanges.push(page);

      currentLine = page.endLine + 1;
    }

    return pageLineRanges;
  }
}

export { NaiveLayoutManager };
