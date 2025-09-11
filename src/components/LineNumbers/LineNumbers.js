export function createLineNumbers() {
  const lineNumbers = document.createElement("div");
  lineNumbers.className = "line-numbers";
  return lineNumbers;
}

export class LineNumbersWidget {
  constructor(container) {
    this.container = container;
    this.lineHeight = 0;
  }

  render(startLine, endLine, totalLines, lineHeight) {
    // Clear existing content
    this.container.innerHTML = "";
    
    this.lineHeight = lineHeight;

    // Ensure the container uses the same line height as the editor
    this.container.style.lineHeight = this.lineHeight + "px";

    // Create spacer for lines before visible area
    const beforeSpacer = document.createElement("div");
    beforeSpacer.style.height = startLine * this.lineHeight + "px";
    this.container.appendChild(beforeSpacer);

    // Render line numbers for visible lines
    for (let lineNum = startLine; lineNum < endLine; lineNum++) {
      const lineNumberEl = document.createElement("div");
      lineNumberEl.className = "line-number";
      lineNumberEl.textContent = (lineNum + 1).toString(); // 1-based line numbers
      lineNumberEl.style.height = this.lineHeight + "px";
      lineNumberEl.style.lineHeight = this.lineHeight + "px";
      this.container.appendChild(lineNumberEl);
    }

    // Create spacer for lines after visible area
    const afterSpacer = document.createElement("div");
    afterSpacer.style.height = (totalLines - endLine) * this.lineHeight + "px";
    this.container.appendChild(afterSpacer);
  }

  syncScroll(scrollTop) {
    this.container.scrollTop = scrollTop;
  }
}