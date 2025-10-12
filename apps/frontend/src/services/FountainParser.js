export class FountainParser {
  parse(text) {
    const lines = text.split(/\r?\n/);
    const modelLines = [];
    const titlePage = {};
    let i = 0;
    let lastKey = null;

    // Parse title page
    while (i < lines.length) {
      const line = lines[i];
      const match = line.match(/^([^:]+):\s*(.*)/);

      if (match) {
        const key = match[1].trim().toLowerCase();
        const value = match[2].trim();
        if (value) {
          titlePage[key] = value;
        } else {
          titlePage[key] = "";
        }
        lastKey = key;
        i++;
      } else if (line.trim() === "") {
        if (lastKey) {
          i++;
          break;
        }
        i++;
      } else if ((line.startsWith("   ") || line.startsWith("\t")) && lastKey) {
        if (titlePage[lastKey]) {
          titlePage[lastKey] += "\n" + line.trim();
        } else {
          titlePage[lastKey] = line.trim();
        }
        i++;
      } else if (!line.includes(":")) {
        // It's a quote line
        if (!titlePage.quote) {
          titlePage.quote = "";
        }
        titlePage.quote += line + "\n";
        i++;
      } else {
        break;
      }
    }

    while (i < lines.length) {
      const line = lines[i];
      const prevLine = lines[i - 1];
      const nextLine = lines[i + 1];

      if (line.trim() === "") {
        // Skip empty lines in the model
        i++;
        continue;
      }

      if (this.isSceneHeading(line, prevLine)) {
        modelLines.push({
          type: "scene-heading",
          segments: this.parseInlineStyles(line.trim()),
        });
        i++;
      } else if (this.isCharacter(line, prevLine, nextLine)) {
        modelLines.push({
          type: "character",
          segments: this.parseInlineStyles(line.trim()),
        });
        i++;
        // Parenthetical + dialogue
        while (i < lines.length && lines[i].trim() !== "") {
          if (this.isParenthetical(lines[i])) {
            modelLines.push({
              type: "parenthetical",
              segments: this.parseInlineStyles(lines[i].trim()),
            });
          } else {
            modelLines.push({
              type: "dialogue",
              segments: this.parseInlineStyles(lines[i]),
            });
          }
          i++;
        }
      } else if (this.isTransition(line, prevLine, nextLine)) {
        modelLines.push({
          type: "transition",
          segments: this.parseInlineStyles(line.trim()),
        });
        i++;
      } else {
        // Default to action
        modelLines.push({
          type: "action",
          segments: this.parseInlineStyles(line.trim()),
        });
        i++;
      }
    }

    return { titlePage, lines: modelLines };
  }

  parseInlineStyles(text) {
    const segments = [];
    // This is a simplified parser. A more robust solution would use a proper tokenizer.
    const regex = /(\*\*\*|\*\*|\*|_)(.*?)\1/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index),
          bold: false,
          italic: false,
          underline: false,
        });
      }

      const marker = match[1];
      const content = match[2];
      let bold = false,
        italic = false,
        underline = false;

      if (marker === "***") {
        bold = true;
        italic = true;
      } else if (marker === "**") {
        bold = true;
      } else if (marker === "*") {
        italic = true;
      } else if (marker === "_") {
        underline = true;
      }

      segments.push({ text: content, bold, italic, underline });
      lastIndex = regex.lastIndex;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        bold: false,
        italic: false,
        underline: false,
      });
    }

    if (segments.length === 0 && text.length > 0) {
      segments.push({
        text: text,
        bold: false,
        italic: false,
        underline: false,
      });
    }

    return segments;
  }

  isSceneHeading(line, previousLine) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith(".") && trimmedLine.length > 1) return true;
    const prevLineEmpty = !previousLine || previousLine.trim() === "";
    return (
      prevLineEmpty && /^(INT|EXT|EST|I\/E|INT\.\/EXT\.).*$/i.test(trimmedLine)
    );
  }

  isCharacter(line, previousLine, nextLine) {
    const trimmedLine = line.trim();
    const prevLineEmpty = !previousLine || previousLine.trim() === "";
    const nextLineNotEmpty = nextLine && nextLine.trim() !== "";
    // A character is all caps, but not a scene heading or transition
    return (
      prevLineEmpty &&
      nextLineNotEmpty &&
      /^[A-Z][A-Z0-9'. ]*(\s*\([^)]+\))*$/.test(trimmedLine) &&
      !this.isSceneHeading(line, previousLine) &&
      !this.isTransition(line, previousLine, nextLine)
    );
  }

  isParenthetical(line) {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("(") && trimmedLine.endsWith(")");
  }

  isTransition(line, previousLine, nextLine) {
    const trimmedLine = line.trim();
    const prevLineEmpty = !previousLine || previousLine.trim() === "";
    const nextLineEmpty = !nextLine || nextLine.trim() === "";
    if (prevLineEmpty && nextLineEmpty && trimmedLine.endsWith("TO:")) {
      return true;
    }
    if (trimmedLine.startsWith(">") && !trimmedLine.endsWith("<")) {
      return true;
    }
    return false;
  }

  export({ titlePage, lines }) {
    let fountainText = "";

    if (titlePage) {
      for (const key in titlePage) {
        if (key === "quote") continue;
        const value = titlePage[key];
        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
        if (value.includes("\n")) {
          fountainText += `${capitalizedKey}:\n`;
          const indentedValue = value
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n");
          fountainText += indentedValue + "\n";
        } else {
          fountainText += `${capitalizedKey}: ${value}\n`;
        }
      }
      if (titlePage.quote) {
        fountainText += "\n" + titlePage.quote.trim() + "\n";
      }
      fountainText += "\n====\n\n";
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.segments.map((s) => this.exportSegment(s)).join("");

      // Write the line itself
      switch (line.type) {
        case "scene-heading":
        case "character":
        case "transition":
          fountainText += text.toUpperCase();
          break;
        default:
          fountainText += text;
          break;
      }

      // Determine the line ending
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1];
        const currentType = line.type;
        const nextType = nextLine.type;

        // No blank line between character and its dialogue/parenthetical
        if (
          currentType === "character" &&
          (nextType === "dialogue" || nextType === "parenthetical")
        ) {
          fountainText += "\n";
        }
        // No blank line between dialogue and its parenthetical
        else if (currentType === "dialogue" && nextType === "parenthetical") {
          fountainText += "\n";
        }
        // No blank line between two dialogue lines
        else if (currentType === "dialogue" && nextType === "dialogue") {
          fountainText += "\n";
        }
        // No blank line between a parenthetical and its dialogue
        else if (currentType === "parenthetical" && nextType === "dialogue") {
          fountainText += "\n";
        }
        // All other cases get a blank line
        else {
          fountainText += "\n\n";
        }
      }
    }
    return fountainText;
  }

  exportSegment(segment) {
    let text = segment.text;
    if (segment.bold && segment.italic) {
      text = `***${text}***`;
    } else if (segment.bold) {
      text = `**${text}**`;
    } else if (segment.italic) {
      text = `*${text}*`;
    }
    if (segment.underline) {
      text = `_${text}_`;
    }
    return text;
  }
}
