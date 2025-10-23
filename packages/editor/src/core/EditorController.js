import {
  transformCursorPosition,
  calculateFinalCursorPosition,
} from "./cursor.js";
import { DeleteTextCommand, InsertTextCommand } from "./commands.js";
import { KeyboardHandler } from "./handlers/KeyboardHandler.js";
import { PointerHandler } from "./handlers/PointerHandler.js";
import { SearchHandler } from "./handlers/SearchHandler.js";
import { ToolbarHandler } from "./handlers/ToolbarHandler.js";

export class EditorController {
  constructor({ model, view, undoManager }) {
    this.model = model;
    this.view = view;
    this.undoManager = undoManager;

    this.hiddenInput = null;
    this.toolbar = null;

    this.pointerHandler = null;
    this.keyBoardHandler = null;
    this.searchHandler = null;
    this.toolbarHandler = null;

    this.plugins = [];
  }

  initialize(toolbar, hiddenInput, searchWidget) {
    this.toolbar = toolbar;
    this.hiddenInput = hiddenInput;
    this.searchWidget = searchWidget;

    this._initializeHandlers();
    this._initializeEventListeners();
  }

  _initializeHandlers() {
    // Setup handlers
    this.pointerHandler = new PointerHandler(this);
    this.keyBoardHandler = new KeyboardHandler(this, this.hiddenInput);
    this.searchHandler = new SearchHandler(this, this.searchWidget);
    this.toolbarHandler = new ToolbarHandler(
      this,
      this.toolbar,
      this.hiddenInput,
    );
  }

  _initializeEventListeners() {
    this.searchHandler.on("close", () => this.hideSearchWidget());

    this.view.container.addEventListener("click", (e) => {
      if (this.searchWidget.contains(e.target)) {
        return;
      }
      this.hiddenInput.focus();
    });
    window.addEventListener("keydown", this.onGlobalKeyDown);
  }

  onGlobalKeyDown = (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && e.key === "s") {
      e.preventDefault();
      this.view.container.dispatchEvent(
        new CustomEvent("plotlines:save-request", { bubbles: true }),
      );
      return;
    }

    if (isCtrlOrCmd && e.key === "f") {
      e.preventDefault();
      this.showSearchWidget();
      return;
    }

    if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }

    if (isCtrlOrCmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (e.key === "Escape") {
      this.hideSearchWidget();
    }
  };

  handleClick({ clientPos }) {
    this.model.clearSelection();
    const { line, ch } = this.view.viewToModelPos(clientPos);
    this.model.updateCursor({ line, ch });
    this.view.render();
    this.hiddenInput.focus();
  }

  handleSetLineType(newType) {
    if (this.model.hasSelection()) {
      return;
    }
    const cursorPos = this.model.getCursorPos();
    const lineIndex = cursorPos.line;
    const lineContent = this.model.getRichTextInRange({
      start: { line: lineIndex, ch: 0 },
      end: { line: lineIndex, ch: this.model.getLineLength(lineIndex) },
    });

    // Update the type of the line content
    if (lineContent.length > 0) {
      lineContent[0].type = newType;
    }

    const commands = [];
    // Delete the old line
    commands.push(
      new DeleteTextCommand({
        start: { line: lineIndex, ch: 0 },
        end: { line: lineIndex, ch: this.model.getLineLength(lineIndex) },
      }),
    );
    // Insert the new line with updated type
    commands.push(
      new InsertTextCommand(lineContent, { line: lineIndex, ch: 0 }),
    );

    this.executeBatchedCommands(commands);
  }

  handleToggleInlineStyle(style) {
    let range;
    if (this.model.hasSelection()) {
      range = this.model.getSelectionRange();
    } else if (this.model.getCursorPos()) {
      range = {
        start: this.model.getCursorPos(),
        end: this.model.getCursorPos(),
      };
    } else {
      return;
    }

    // Check if selection spans multiple lines
    if (range.start.line !== range.end.line) {
      this.view.container.dispatchEvent(
        new CustomEvent("plotlines:toast", {
          bubbles: true,
          detail: {
            message: "Cannot toggle inline style across multiple lines.",
            type: "error",
          },
        }),
      );
      return;
    }

    const lineIndex = range.start.line;
    const startCh = range.start.ch;
    const endCh = range.end.ch;

    // Get the rich text of the selected range
    const richTextToStyle = this.model.getRichTextInRange(range);

    // Apply the style change to the rich text
    for (const line of richTextToStyle) {
      for (const segment of line.segments) {
        segment[style] = !segment[style];
      }
    }

    const commands = [];
    // Delete the old text
    commands.push(new DeleteTextCommand(range));
    // Insert the new styled text
    commands.push(new InsertTextCommand(richTextToStyle, range.start));

    this.executeBatchedCommands(commands);
  }

  async handleCut() {
    if (this.model.hasSelection()) {
      const range = this.model.getSelectionRange();
      const richText = this.model.getRichTextInRange(range);
      try {
        this._writeToClipboard(richText);
        this.executeCommands([new DeleteTextCommand(range)]);
      } catch (error) {
        console.error("Cut failed:", error);
      }
    }
  }

  async handleCopy() {
    if (this.model.hasSelection()) {
      const range = this.model.getSelectionRange();
      const richText = this.model.getRichTextInRange(range);
      try {
        this._writeToClipboard(richText);
      } catch (error) {
        console.error("Copy failed:", error);
      }
    }
  }

  async handlePaste() {
    try {
      const clipboardItems = await navigator.clipboard.read();
      let richText = null;

      for (const item of clipboardItems) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          const html = await blob.text();
          richText = this._parseHTMLToRichText(html);
          break;
        }
      }

      if (!richText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cursorPos = this.model.getCursorPos();
          const lineType = this.model.lines[cursorPos.line].type;
          richText = text.split("\n").map((lineText) => ({
            type: lineType,
            segments: [
              { text: lineText, bold: false, italic: false, underline: false },
            ],
          }));
        }
      }

      if (richText) {
        const tr = [];
        if (this.model.hasSelection()) {
          const range = this.model.getSelectionRange();
          tr.push(new DeleteTextCommand(range));
        }
        tr.push(new InsertTextCommand(richText, this.model.getCursorPos()));
        this.model.clearSelection();
        this.executeCommands(tr);
      }
    } catch (error) {
      console.error("Paste failed:", error);
    }
  }

  handleSearch() {
    this.showSearchWidget();
  }

  showSearchWidget() {
    this.searchWidget.classList.remove("hidden");
    this.searchWidget.querySelector(".search-input").focus();
  }

  hideSearchWidget() {
    this.searchWidget.classList.add("hidden");
    this.focusEditor();
  }

  focusEditor() {
    this.hiddenInput.focus();
    this.view.render();
  }

  _writeToClipboard(richText) {
    const html = this._convertRichTextToHTML(richText);
    const plainText = this._convertRichTextToPlainText(richText);
    const clipboardData = [
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ];
    return navigator.clipboard.write(clipboardData);
  }

  _convertRichTextToPlainText(richText) {
    return richText
      .map((line) => line.segments.map((segment) => segment.text).join(""))
      .join("\n");
  }

  _escapeHtml(text) {
    return text.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
      }
    });
  }

  _convertRichTextToHTML(richText) {
    let html = "";
    for (const line of richText) {
      let lineHtml = `<div data-line-type="${line.type}">`;
      if (
        line.segments.length === 0 ||
        (line.segments.length === 1 && !line.segments[0].text)
      ) {
        lineHtml += `<span>&nbsp;</span>`;
      } else {
        for (const segment of line.segments) {
          let content = this._escapeHtml(segment.text);
          if (segment.bold) content = `<b>${content}</b>`;
          if (segment.italic) content = `<i>${content}</i>`;
          if (segment.underline) content = `<u>${content}</u>`;
          lineHtml += content;
        }
      }
      lineHtml += `</div>`;
      html += lineHtml;
    }
    return html;
  }

  _parseHTMLToRichText(html) {
    const richText = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const lines = doc.body.querySelectorAll("div");

    for (const lineNode of lines) {
      const line = {
        type: lineNode.dataset.lineType || "action",
        segments: [],
      };

      const processNode = (node, styles = {}) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent) {
            line.segments.push({ text: node.textContent, ...styles });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const newStyles = { ...styles };
          const tagName = node.tagName.toLowerCase();
          if (tagName === "b" || node.style.fontWeight === "bold")
            newStyles.bold = true;
          if (tagName === "i" || node.style.fontStyle === "italic")
            newStyles.italic = true;
          if (tagName === "u" || node.style.textDecoration === "underline")
            newStyles.underline = true;

          for (const child of node.childNodes) {
            processNode(child, newStyles);
          }
        }
      };

      for (const child of lineNode.childNodes) {
        processNode(child);
      }

      // Merge segments
      if (line.segments.length > 1) {
        const merged = [line.segments[0]];
        for (let i = 1; i < line.segments.length; i++) {
          const current = line.segments[i];
          const previous = merged[merged.length - 1];
          if (
            current.bold === previous.bold &&
            current.italic === previous.italic &&
            current.underline === previous.underline
          ) {
            previous.text += current.text;
          } else {
            merged.push(current);
          }
        }
        line.segments = merged;
      }

      richText.push(line);
    }
    return richText;
  }

  // ===================================================================
  //  Plugin Management
  // ===================================================================
  registerPlugin(plugin) {
    this.plugins.push(plugin);
    if (plugin.onRegister) {
      plugin.onRegister(this);
    }
  }

  updateRemoteCursors(remoteCursors) {
    this.view.updateRemoteCursors(remoteCursors);
  }

  destroyPlugin(pluginName) {
    const pluginIndex = this.plugins.findIndex(
      (p) => p.constructor.name === pluginName,
    );
    if (pluginIndex === -1) return;

    const plugin = this.plugins[pluginIndex];
    if (plugin.destroy) {
      plugin.destroy();
    }

    this.plugins.splice(pluginIndex, 1);
  }

  dispatchEventToPlugins(eventName, data) {
    for (const plugin of this.plugins) {
      if (plugin.onEvent) {
        plugin.onEvent(eventName, data);
      }
    }
  }

  // ===================================================================
  //  Command Execution
  // ===================================================================

  // Public API for local user actions
  executeCommands(commands) {
    console.log(
      "EditorController: executeCommands called with commands:",
      commands,
    );
    for (const command of commands) {
      const preState = {
        cursor: this.model.getCursorPos(),
        selection: this.model.getSelectionRange(),
      };
      const initialCursor = this.model.getCursorPos();
      command.execute(this.model);
      const rebasedCursor = transformCursorPosition(initialCursor, command);
      if (command instanceof DeleteTextCommand) {
        this.model.clearSelection();
      }
      this.model.updateCursor(rebasedCursor);
      const postState = {
        cursor: this.model.getCursorPos(),
        selection: this.model.getSelectionRange(),
      };
      this.undoManager.add(command, preState, postState);
      this.dispatchEventToPlugins("command", command);
    }
    this.view.render();
  }

  // For applying changes from remote sources, from undomanager etc, bypass adding to undo
  executeCommandsBypassUndo(commands) {
    const initialCursor = this.model.getCursorPos();
    for (const command of commands) {
      command.execute(this.model);
    }
    const finalCursor = calculateFinalCursorPosition(initialCursor, commands);
    this.model.updateCursor(finalCursor);
    this.view.render();
  }

  // Public API for local user actions that should be batched as a single undo/redo unit
  executeBatchedCommands(commands) {
    this.undoManager.beginBatch();
    for (const command of commands) {
      const preState = {
        cursor: this.model.getCursorPos(),
        selection: this.model.getSelectionRange(),
      };
      const initialCursor = this.model.getCursorPos();
      command.execute(this.model);
      const rebasedCursor = transformCursorPosition(initialCursor, command);
      if (command instanceof DeleteTextCommand) {
        this.model.clearSelection();
      }
      this.model.updateCursor(rebasedCursor);
      const postState = {
        cursor: this.model.getCursorPos(),
        selection: this.model.getSelectionRange(),
      };
      this.undoManager.add(command, preState, postState, true); // Force batching
      this.dispatchEventToPlugins("command", command);
    }
    this.undoManager.endBatch();
    this.view.render();
  }

  undo() {
    const batch = this.undoManager.getCommandsForUndo();
    if (batch) {
      for (const item of [...batch].reverse()) {
        const invertedCommand = item.command.invert();
        console.log("EditorController: undoing command:", invertedCommand);
        this.executeCommandsBypassUndo([invertedCommand]);
        this.dispatchEventToPlugins("command", invertedCommand);
        this.model.updateCursor(item.preState.cursor);
        this.model.setSelectionRange(item.preState.selection);
      }
    }
    this.view.render();
  }

  redo() {
    const batch = this.undoManager.getCommandsForRedo();
    if (batch) {
      for (const item of batch) {
        console.log("EditorController: redoing command:", item.command);
        this.model.updateCursor(item.preState.cursor);
        this.model.setSelectionRange(item.preState.selection);
        this.executeCommandsBypassUndo([item.command]);
        this.dispatchEventToPlugins("command", item.command);
      }
      this.view.render();
    }
  }
}
