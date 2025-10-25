import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Page dimensions in points (1 inch = 72 points)
const PAGE_WIDTH = 8.5 * 72; // 612 pt
const PAGE_HEIGHT = 11 * 72; // 792 pt

// Margins in points (from your editorcontainer.css: padding: 1in 1in 1in 1.5in;)
const MARGIN_TOP = 1 * 72; // 72 pt
const MARGIN_RIGHT = 1 * 72; // 72 pt
const MARGIN_BOTTOM = 1 * 72; // 72 pt
const MARGIN_LEFT = 1.5 * 72; // 108 pt

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Pixel -> point conversion (browser CSS pixels assumed 96dpi)
const PX_TO_PT = 72 / 96; // = 0.75

export class PdfExportService {
  constructor(editorView) {
    this.editorView = editorView;
    this.layoutManager = editorView.layoutManager;
    this.model = editorView.model;

    // Use standard Courier family from pdf-lib; we'll embed each variant.
    this.stdFonts = {
      regular: StandardFonts.Courier,
      bold: StandardFonts.CourierBold,
      italic: StandardFonts.CourierOblique,
      boldItalic: StandardFonts.CourierBoldOblique,
    };

    // Editor-provided base line height (px) -> points
    this.baseLineHeightPx = editorView.BASE_LINE_HEIGHT;
    this.baseLineHeightPt = this.baseLineHeightPx * PX_TO_PT;
    this.fontSizePt = this.baseLineHeightPt; // use same size in PDF for visual parity

    // Map line types to left indents (in inches) based on your CSS
    // these values directly reflect the margin-left rules you gave.
    this.typeIndentIn = {
      "scene-heading": 0,
      action: 0,
      character: 2,
      parenthetical: 1.5,
      dialogue: 1,
      transition: 4.5,
      shot: 0,
    };

    // Types that should be rendered uppercase (CSS text-transform: uppercase)
    this.uppercaseTypes = new Set([
      "scene-heading",
      "character",
      "transition",
      "shot",
    ]);

    // Types that should be right-aligned
    this.rightAlignTypes = new Set(["transition"]);

    // We'll rely on editorView.ELEMENT_CHARS_PER_ROW for wrapping widths.
  }

  async exportPdf(filename = "screenplay.pdf") {
    const pages = this.layoutManager.getPageLineRanges();
    const pdfDoc = await PDFDocument.create();

    // Embed fonts
    const embedded = {
      regular: await pdfDoc.embedFont(this.stdFonts.regular),
      bold: await pdfDoc.embedFont(this.stdFonts.bold),
      italic: await pdfDoc.embedFont(this.stdFonts.italic),
      boldItalic: await pdfDoc.embedFont(this.stdFonts.boldItalic),
    };

    for (let p = 0; p < pages.length; p++) {
      const pageInfo = pages[p];
      const pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      // Start Y at the top margin (pdf origin is bottom-left, so we count down)
      let currentY = PAGE_HEIGHT - MARGIN_TOP;

      for (const entry of pageInfo.lines) {
        const lineIndex = entry.index;
        const lineObj = this.model.lines[lineIndex];
        const lineType = lineObj.type;

        // Apply top spacing (px -> pt)
        const topSpacingPt = (entry.topSpacing || 0) * PX_TO_PT;
        currentY -= topSpacingPt;

        // Compute left indent in points based on CSS margin-left (inches)
        const indentIn = this.typeIndentIn[lineType] || 0;
        const indentPt = MARGIN_LEFT + indentIn * 72;

        // Get wrapped rows from editor (these rows respect ELEMENT_CHARS_PER_ROW)
        const rows = this.editorView.getWrappedRows(lineIndex);

        // We'll render each wrapped row. We must slice segments to match the characters in each row.
        let rowCharOffset = 0;
        for (let r = 0; r < rows.length; r++) {
          let rowText = rows[r];

          // Visual transform from CSS: uppercase types
          const renderText = this.uppercaseTypes.has(lineType)
            ? rowText.toUpperCase()
            : rowText;

          // For right-aligned types, compute width and adjust x
          let cursorX = indentPt;
          if (this.rightAlignTypes.has(lineType)) {
            // Measure full row width using the regular font (we'll measure styled slices below
            // when drawing; but approximate width by measuring the plain row using regular font
            // to compute starting X.
            const approxWidth = embedded.regular.widthOfTextAtSize(
              renderText,
              this.fontSizePt,
            );
            cursorX = MARGIN_LEFT + CONTENT_WIDTH - approxWidth;
          }

          // Walk segments to draw only the slice for this row. We must be careful because
          // segments may carry styles (bold/italic). We'll preserve that styling.
          let segCursor = 0;
          let segStartRenderPos = 0; // how many chars we've already consumed for this row

          for (const seg of lineObj.segments) {
            const segText = seg.text || "";
            const segLen = segText.length;

            // If this segment ends before the current row slice, skip it.
            if (segCursor + segLen <= rowCharOffset) {
              segCursor += segLen;
              continue;
            }

            if (segCursor >= rowCharOffset + rowText.length) break; // beyond this row

            const sliceStartInSeg = Math.max(0, rowCharOffset - segCursor);
            const sliceEndInSeg = Math.min(
              segLen,
              rowCharOffset + rowText.length - segCursor,
            );
            let sliceText = segText.slice(sliceStartInSeg, sliceEndInSeg);

            // Apply uppercase transform to slice if needed
            if (this.uppercaseTypes.has(lineType))
              sliceText = sliceText.toUpperCase();

            // Pick font variant
            let fontToUse = embedded.regular;

            // Scene headings and shots are bold by default
            if (lineType === "scene-heading" || lineType === "shot") {
              fontToUse = embedded.bold;
            }

            const bold = !!seg.bold;
            const italic = !!seg.italic;
            if (bold && italic) fontToUse = embedded.boldItalic;
            else if (bold) fontToUse = embedded.bold;
            else if (italic) fontToUse = embedded.italic;

            // Draw the slice
            pdfPage.drawText(sliceText, {
              x: cursorX,
              y: currentY - this.fontSizePt,
              size: this.fontSizePt,
              font: fontToUse,
            });

            // Advance X by measured width of the slice
            const sliceWidth = fontToUse.widthOfTextAtSize(
              sliceText,
              this.fontSizePt,
            );
            cursorX += sliceWidth;

            segCursor += segLen;
            segStartRenderPos += sliceText.length;
          }

          // Move down by one line (base line height in points)
          currentY -= this.baseLineHeightPt;

          rowCharOffset += rowText.length;
        }
      }
    }

    // Save and trigger download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
