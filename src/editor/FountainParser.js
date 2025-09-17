export class FountainParser {
  parse(text) {
    const lines = text.split(/\r?\n/);
    const modelLines = [];
    let i = 0;

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

    return modelLines;
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
      prevLineEmpty && /^(INT|EXT|EST|I\/E|INT\.\/EXT\.)/i.test(trimmedLine)
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

  export(lines) {
    let fountainText = "";
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const text = line.segments.map(s => this.exportSegment(s)).join('');

        // Write the line itself
        switch (line.type) {
            case 'scene-heading':
            case 'character':
            case 'transition':
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
            if (currentType === 'character' && (nextType === 'dialogue' || nextType === 'parenthetical')) {
                fountainText += "\n";
            }
            // No blank line between dialogue and its parenthetical
            else if (currentType === 'dialogue' && nextType === 'parenthetical') {
                fountainText += "\n";
            }
            // No blank line between two dialogue lines
            else if (currentType === 'dialogue' && nextType === 'dialogue') {
                fountainText += "\n";
            }
            // No blank line between a parenthetical and its dialogue
            else if (currentType === 'parenthetical' && nextType === 'dialogue') {
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
