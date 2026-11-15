import { ProjectSummary } from '../types';

// ==============================================================================
// Er.NEXA — High-Fidelity Autonomous PDF Generator
// Generates standard PDF-1.4 binary documents directly with 0 external dependencies.
// Features: Pixel-perfect typography, running headers/footers, dynamic pagination ("Page X of Y"),
// tables, cards, badges, and Er.NEXA crimson branding (#C1121F).
// ==============================================================================

function getCharWidth(char: string, font: string): number {
  if (font === 'Courier') return 0.60;
  const c = char.charCodeAt(0);
  if (c === 32) return 0.28; // Space
  if (c >= 65 && c <= 90) { // Uppercase
    if ('MW'.includes(char)) return 0.78;
    if ('I'.includes(char)) return 0.28;
    if ('JL'.includes(char)) return 0.52;
    return font === 'Helvetica-Bold' ? 0.68 : 0.62;
  }
  if (c >= 97 && c <= 122) { // Lowercase
    if ('mw'.includes(char)) return 0.72;
    if ('ijlft'.includes(char)) return 0.28;
    if ('r'.includes(char)) return 0.35;
    return font === 'Helvetica-Bold' ? 0.56 : 0.50;
  }
  if (c >= 48 && c <= 57) return 0.52; // Digits
  if ('.,:;!\'|/\\'.includes(char)) return 0.25;
  if ('()[]{}<>'.includes(char)) return 0.35;
  if ('-_+=*&^%$#@`~'.includes(char)) return 0.52;
  return 0.50;
}

function getTextWidth(text: string, fontSize: number, font: string = 'Helvetica'): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += getCharWidth(text[i], font) * fontSize;
  }
  return width;
}

function wrapText(text: string, maxWidth: number, fontSize: number, font: string = 'Helvetica'): string[] {
  const paragraphs = String(text || '').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }

    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = getTextWidth(testLine, fontSize, font);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
          currentLine = '';
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function escapePdfText(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (ch === '\t') return '  ';
      if (ch === '→') return '->';
      if (ch === '←') return '<-';
      if (ch === '✓') return '[OK]';
      if (ch === '✔') return '[OK]';
      if (ch === '✕' || ch === '✖') return '[X]';
      return '?';
    });
}

type RGB = [number, number, number];

class SummaryPdfDoc {
  pageWidth = 595.28;  // A4 points
  pageHeight = 841.89; // A4 points
  margin = 42;
  contentWidth = 595.28 - 42 * 2; // 511.28 pt
  pages: string[][] = [];
  currentPageOps: string[] = [];
  currentY = 0;
  projectName: string;

  // Er.NEXA Palette
  brandCrimson: RGB = [0.757, 0.071, 0.122]; // #C1121F
  brandDark: RGB = [0.120, 0.120, 0.120];    // #1E1E1E
  brandMuted: RGB = [0.380, 0.380, 0.380];   // #616161
  brandLightBorder: RGB = [0.880, 0.880, 0.880]; // #E0E0E0
  brandCardBg: RGB = [0.985, 0.985, 0.980];  // #FAFAF5
  verifiedGreen: RGB = [0.020, 0.588, 0.412]; // #059669
  verifiedGreenBg: RGB = [0.925, 0.992, 0.961]; // #ECFDF5
  inferredBlue: RGB = [0.010, 0.520, 0.780];  // #0284C7
  inferredBlueBg: RGB = [0.940, 0.975, 1.000]; // #F0F9FF
  amberWarning: RGB = [0.850, 0.470, 0.020];  // #D97706
  amberWarningBg: RGB = [1.000, 0.985, 0.920]; // #FFFBEB
  redDanger: RGB = [0.860, 0.150, 0.150];     // #DC2626
  redDangerBg: RGB = [1.000, 0.950, 0.950];   // #FEF2F2

  constructor(projectName: string) {
    this.projectName = projectName;
    this.addPage();
  }

  addPage() {
    if (this.currentPageOps.length > 0) {
      this.pages.push(this.currentPageOps);
      this.currentPageOps = [];
    }
    this.currentY = this.pageHeight - 56; // Start below running header
  }

  ensureSpace(neededHeight: number) {
    if (this.currentY - neededHeight < 56) {
      this.addPage();
    }
  }

  setColor(rgb: RGB, isStroke: boolean = false) {
    const op = isStroke
      ? `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} RG`
      : `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`;
    this.currentPageOps.push(op);
  }

  setLineWidth(w: number) {
    this.currentPageOps.push(`${w.toFixed(2)} w`);
  }

  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor: RGB | null = null,
    strokeColor: RGB | null = null,
    lineWidth: number = 0.75
  ) {
    if (fillColor) {
      this.setColor(fillColor, false);
    }
    if (strokeColor) {
      this.setColor(strokeColor, true);
      this.setLineWidth(lineWidth);
    }
    const op = fillColor && strokeColor ? 'B' : fillColor ? 'f' : 'S';
    this.currentPageOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: RGB = [0.85, 0.85, 0.85], width: number = 0.75) {
    this.setColor(color, true);
    this.setLineWidth(width);
    this.currentPageOps.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  drawText(
    text: string,
    x: number,
    y: number,
    font: 'Helvetica' | 'Helvetica-Bold' | 'Courier' = 'Helvetica',
    size: number = 10,
    color: RGB = [0.12, 0.12, 0.12]
  ) {
    this.setColor(color, false);
    const escaped = escapePdfText(text);
    const fontCode = font === 'Helvetica-Bold' ? '/F2' : font === 'Courier' ? '/F3' : '/F1';
    this.currentPageOps.push(`BT ${fontCode} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`);
  }

  drawBadge(text: string, x: number, y: number, bg: RGB, textRgb: RGB, font: 'Helvetica' | 'Helvetica-Bold' = 'Helvetica-Bold', fontSize: number = 8): number {
    const w = getTextWidth(text, fontSize, font) + 10;
    const h = fontSize + 6;
    this.drawRect(x, y - 2, w, h, bg, null);
    this.drawText(text, x + 5, y + 2, font, fontSize, textRgb);
    return w;
  }

  drawSectionHeader(title: string, countBadge?: number | string, subtitle?: string) {
    this.ensureSpace(subtitle ? 42 : 32);
    this.currentY -= 14;

    // Red accent block
    this.drawRect(this.margin, this.currentY - 2, 4, 15, this.brandCrimson, null);

    // Title text
    this.drawText(title, this.margin + 10, this.currentY + 1, 'Helvetica-Bold', 12, this.brandDark);

    let offset = this.margin + 12 + getTextWidth(title, 12, 'Helvetica-Bold');
    if (countBadge !== undefined && countBadge !== null) {
      const badgeText = String(countBadge);
      this.drawBadge(badgeText, offset + 6, this.currentY, [0.95, 0.95, 0.95], this.brandCrimson, 'Helvetica-Bold', 8);
    }

    // Horizontal separator
    this.drawLine(this.margin, this.currentY - 6, this.pageWidth - this.margin, this.currentY - 6, this.brandLightBorder, 0.5);
    this.currentY -= 12;

    if (subtitle) {
      this.drawText(subtitle, this.margin, this.currentY, 'Helvetica', 8.5, this.brandMuted);
      this.currentY -= 12;
    }
  }

  drawParagraph(text: string, maxWidth?: number, fontSize: number = 9.5, color: RGB = [0.2, 0.2, 0.2], lineHeight: number = 13.5): number {
    const width = maxWidth || this.contentWidth;
    const lines = wrapText(text, width, fontSize, 'Helvetica');
    const totalHeight = lines.length * lineHeight;

    this.ensureSpace(Math.min(totalHeight, 60));

    for (const line of lines) {
      if (this.currentY < 60) {
        this.addPage();
      }
      this.drawText(line, this.margin, this.currentY, 'Helvetica', fontSize, color);
      this.currentY -= lineHeight;
    }

    return totalHeight;
  }

  drawBulletItem(bullet: string, text: string, indent: number = 24, fontSize: number = 8.5, bulletColor: RGB = [0.757, 0.071, 0.122]) {
    const bulletWidth = getTextWidth(bullet, fontSize, 'Helvetica-Bold');
    const safeIndent = Math.max(indent, bulletWidth + 8);
    const textWidth = this.contentWidth - safeIndent;
    const lines = wrapText(text, textWidth, fontSize, 'Helvetica');
    const itemHeight = lines.length * 12 + 4;

    this.ensureSpace(itemHeight);

    this.drawText(bullet, this.margin + 4, this.currentY, 'Helvetica-Bold', fontSize, bulletColor);
    for (let i = 0; i < lines.length; i++) {
      if (this.currentY < 60) {
        this.addPage();
      }
      this.drawText(lines[i], this.margin + safeIndent, this.currentY, 'Helvetica', fontSize, this.brandDark);
      this.currentY -= 12;
    }
    this.currentY -= 2;
  }

  buildPdfBytes(): Uint8Array {
    if (this.currentPageOps.length > 0) {
      this.pages.push(this.currentPageOps);
      this.currentPageOps = [];
    }

    const totalPages = this.pages.length;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    // Inject Running Headers and Running Footers with calculated total pages
    for (let i = 0; i < totalPages; i++) {
      const pageOps = this.pages[i];
      const pageNum = i + 1;

      const headerOps: string[] = [];
      // Er.NEXA Crimson square bar
      headerOps.push(`0.757 0.071 0.122 rg 42.00 ${(this.pageHeight - 34).toFixed(2)} 3.50 16.00 re f`);
      // Logo and Header title
      headerOps.push(`BT /F2 9.00 Tf 0.120 0.120 0.120 rg 50.00 ${(this.pageHeight - 28).toFixed(2)} Td (Er.NEXA) Tj ET`);
      headerOps.push(`BT /F1 8.00 Tf 0.400 0.400 0.400 rg 92.00 ${(this.pageHeight - 28).toFixed(2)} Td (|  Project Knowledge Reconstruction Summary) Tj ET`);

      // Project title right
      const safeProjectName = escapePdfText(this.projectName.length > 28 ? this.projectName.slice(0, 26) + '...' : this.projectName);
      const rightHeader = `${safeProjectName}  --  ${dateStr}`;
      const rightHeaderWidth = getTextWidth(rightHeader, 7.5, 'Helvetica');
      headerOps.push(`BT /F1 7.50 Tf 0.450 0.450 0.450 rg ${(this.pageWidth - 42 - rightHeaderWidth).toFixed(2)} ${(this.pageHeight - 28).toFixed(2)} Td (${rightHeader}) Tj ET`);

      // Top Header Divider Line
      headerOps.push(`0.860 0.860 0.860 RG 0.50 w 42.00 ${(this.pageHeight - 39).toFixed(2)} m ${(this.pageWidth - 42).toFixed(2)} ${(this.pageHeight - 39).toFixed(2)} l S`);

      // Bottom Running Footer
      const footerOps: string[] = [];
      footerOps.push(`0.860 0.860 0.860 RG 0.50 w 42.00 42.00 m ${(this.pageWidth - 42).toFixed(2)} 42.00 l S`);
      footerOps.push(`BT /F1 7.50 Tf 0.480 0.480 0.480 rg 42.00 28.00 Td (Er.NEXA Engineering Intelligence  *  Autonomous Source Code & Knowledge Synthesis) Tj ET`);

      const pageText = `Page ${pageNum} of ${totalPages}`;
      const pageTextWidth = getTextWidth(pageText, 8.0, 'Helvetica-Bold');
      footerOps.push(`BT /F2 8.00 Tf 0.350 0.350 0.350 rg ${(this.pageWidth - 42 - pageTextWidth).toFixed(2)} 28.00 Td (${pageText}) Tj ET`);

      this.pages[i] = [...headerOps, ...pageOps, ...footerOps];
    }

    // Assemble PDF-1.4 file
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];

    const encoder = new TextEncoder();

    function getByteLength(str: string): number {
      return encoder.encode(str).length;
    }

    function addObj(content: string): number {
      offsets.push(getByteLength(out));
      const objId = offsets.length;
      out += `${objId} 0 obj\n${content}\nendobj\n`;
      return objId;
    }

    const font1Id = 3;
    const font2Id = 4;
    const font3Id = 5;

    const pageObjStart = 6;
    const streamObjStart = 6 + totalPages;

    const pageKids: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      pageKids.push(`${pageObjStart + i} 0 R`);
    }

    // 1. Catalog
    addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

    // 2. Pages
    addObj(`<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${totalPages} >>`);

    // 3. F1 Helvetica
    addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

    // 4. F2 Helvetica-Bold
    addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

    // 5. F3 Courier
    addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`);

    // Page objects
    for (let i = 0; i < totalPages; i++) {
      const contentId = streamObjStart + i;
      addObj(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
    }

    // Stream objects
    for (let i = 0; i < totalPages; i++) {
      const streamContent = this.pages[i].join('\n');
      const streamLen = getByteLength(streamContent);
      addObj(`<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`);
    }

    // XRef Table
    const startXref = getByteLength(out);
    const totalObjs = offsets.length + 1;
    out += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;

    for (let i = 0; i < offsets.length; i++) {
      const off = String(offsets[i]).padStart(10, '0');
      out += `${off} 00000 n \n`;
    }

    out += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return encoder.encode(out);
  }
}

/**
 * Main export: Generates and downloads a complete, professionally formatted PDF
 * containing the entire AI-generated project summary.
 */
export function generateProjectSummaryPdf(summary: ProjectSummary, projectName?: string): void {
  const intro = summary.introduction || ({} as any);
  const resolvedProjectName = projectName || intro.name || 'Project Knowledge Base';
  const doc = new SummaryPdfDoc(resolvedProjectName);

  // ==========================================
  // 1. FRONT COVER / EXECUTIVE BANNER
  // ==========================================
  doc.currentY -= 10;

  // Er.NEXA Brand Header Box
  doc.drawRect(doc.margin, doc.currentY - 65, doc.contentWidth, 75, [0.985, 0.985, 0.990], doc.brandLightBorder, 1);
  doc.drawRect(doc.margin, doc.currentY - 65, 5, 75, doc.brandCrimson, null);

  doc.drawText('ER.NEXA  *  AI PROJECT KNOWLEDGE RECONSTRUCTION PLATFORM', doc.margin + 16, doc.currentY - 2, 'Helvetica-Bold', 8, doc.brandCrimson);
  doc.drawText(resolvedProjectName, doc.margin + 16, doc.currentY - 20, 'Helvetica-Bold', 17, doc.brandDark);

  if (intro.tagline) {
    doc.drawText(intro.tagline, doc.margin + 16, doc.currentY - 34, 'Helvetica', 9.5, doc.brandMuted);
  }

  // Badges row: Architecture Style, Languages, Frameworks
  let badgeX = doc.margin + 16;
  const badgeY = doc.currentY - 54;

  if (intro.architectureStyle) {
    const w = doc.drawBadge(intro.architectureStyle, badgeX, badgeY, [0.93, 0.93, 0.95], doc.brandDark, 'Helvetica-Bold', 7.5);
    badgeX += w + 6;
  }

  const primaryLangs = (intro.primaryLanguages || []).slice(0, 3).join(', ');
  if (primaryLangs) {
    const w = doc.drawBadge(`Lang: ${primaryLangs}`, badgeX, badgeY, [0.94, 0.94, 0.94], doc.brandMuted, 'Helvetica', 7.5);
    badgeX += w + 6;
  }

  const frameworks = (intro.frameworks || []).slice(0, 3).join(', ');
  if (frameworks) {
    doc.drawBadge(`Stack: ${frameworks}`, badgeX, badgeY, [0.98, 0.92, 0.92], doc.brandCrimson, 'Helvetica-Bold', 7.5);
  }

  doc.currentY -= 82;

  // ==========================================
  // 2. KEY METRICS STATS GRID (4 KPI BOXES)
  // ==========================================
  const verifiedCount = intro.verifiedFacts?.length || 0;
  const decisionsCount = summary.decisions?.length || 0;
  const funcsCount = summary.existingFunctionalities?.length || 0;
  const debtCount = summary.unfinishedTasks?.length || 0;

  const cardWidth = (doc.contentWidth - 18) / 4;
  const cardHeight = 44;

  const kpis = [
    { label: 'Verified Facts', count: verifiedCount, color: doc.verifiedGreen, bg: doc.verifiedGreenBg },
    { label: 'Key Decisions', count: decisionsCount, color: doc.inferredBlue, bg: doc.inferredBlueBg },
    { label: 'Core Modules', count: funcsCount, color: doc.brandDark, bg: [0.95, 0.95, 0.97] as RGB },
    { label: 'Tasks & Debt', count: debtCount, color: doc.amberWarning, bg: doc.amberWarningBg },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const kpi = kpis[i];
    const kpiX = doc.margin + i * (cardWidth + 6);
    doc.drawRect(kpiX, doc.currentY - cardHeight, cardWidth, cardHeight, kpi.bg, doc.brandLightBorder, 0.5);
    doc.drawText(String(kpi.count), kpiX + 10, doc.currentY - 20, 'Helvetica-Bold', 15, kpi.color);
    doc.drawText(kpi.label, kpiX + 10, doc.currentY - 34, 'Helvetica', 8, doc.brandMuted);
  }

  doc.currentY -= (cardHeight + 14);

  // Project Description
  if (intro.description) {
    doc.drawText('PROJECT OVERVIEW', doc.margin, doc.currentY, 'Helvetica-Bold', 8.5, doc.brandMuted);
    doc.currentY -= 12;
    doc.drawParagraph(intro.description, doc.contentWidth, 9, [0.22, 0.22, 0.22], 13);
    doc.currentY -= 10;
  }

  // ==========================================
  // 3. FACT GROUNDING: VERIFIED, INFERENCES, UNKNOWNS
  // ==========================================
  doc.drawSectionHeader('Ground Truth & Knowledge Distinctions', undefined, 'Rigorous differentiation between code-verified facts, AI inferences, and unresolved gaps.');

  const colWidth = (doc.contentWidth - 16) / 3;
  const boxTop = doc.currentY;

  // Subsection 3A: Verified Facts (Grounded in Code)
  const facts = intro.verifiedFacts || [];
  doc.ensureSpace(120);

  doc.drawRect(doc.margin, doc.currentY - 18, doc.contentWidth, 20, doc.verifiedGreenBg, [0.75, 0.90, 0.82], 0.5);
  doc.drawText(`VERIFIED FACTS FROM SOURCE REPOSITORY (${facts.length})`, doc.margin + 8, doc.currentY - 14, 'Helvetica-Bold', 8.5, doc.verifiedGreen);
  doc.currentY -= 26;

  if (facts.length === 0) {
    doc.drawBulletItem('*', 'No verified facts were recorded during code parsing.', 12, 8.5, doc.brandMuted);
  } else {
    for (const f of facts) {
      doc.drawBulletItem('[OK]', f, 14, 8.5, doc.verifiedGreen);
    }
  }
  doc.currentY -= 8;

  // Subsection 3B: AI Inferences & Structural Hypotheses
  const inferences = intro.aiInferences || [];
  doc.ensureSpace(80);
  doc.drawRect(doc.margin, doc.currentY - 18, doc.contentWidth, 20, doc.inferredBlueBg, [0.75, 0.88, 0.98], 0.5);
  doc.drawText(`AI INFERENCES & ARCHITECTURAL HYPOTHESES (${inferences.length})`, doc.margin + 8, doc.currentY - 14, 'Helvetica-Bold', 8.5, doc.inferredBlue);
  doc.currentY -= 26;

  if (inferences.length === 0) {
    doc.drawBulletItem('*', 'No AI-inferred assumptions generated.', 12, 8.5, doc.brandMuted);
  } else {
    for (const inf of inferences) {
      doc.drawBulletItem('[AI]', inf, 14, 8.5, doc.inferredBlue);
    }
  }
  doc.currentY -= 8;

  // Subsection 3C: Unknown / Missing Areas
  const unknowns = intro.unknowns || [];
  if (unknowns.length > 0) {
    doc.ensureSpace(60);
    doc.drawRect(doc.margin, doc.currentY - 18, doc.contentWidth, 20, doc.amberWarningBg, [0.95, 0.85, 0.70], 0.5);
    doc.drawText(`UNKNOWN & UNVERIFIED AREAS (${unknowns.length})`, doc.margin + 8, doc.currentY - 14, 'Helvetica-Bold', 8.5, doc.amberWarning);
    doc.currentY -= 26;
    for (const un of unknowns) {
      doc.drawBulletItem('[?]', un, 14, 8.5, doc.amberWarning);
    }
    doc.currentY -= 8;
  }

  // ==========================================
  // 4. IMPORTANT PROJECT DECISIONS
  // ==========================================
  const decisions = summary.decisions || [];
  doc.drawSectionHeader('Important Architectural Decisions', decisions.length, 'Key technical choices, library adoptions, and design patterns inferred from code evidence.');

  if (decisions.length === 0) {
    doc.drawParagraph('No explicit architectural decisions recorded for this project.', doc.contentWidth, 8.5, doc.brandMuted);
    doc.currentY -= 6;
  } else {
    for (const dec of decisions) {
      const decisionLines = wrapText(dec.decision, doc.contentWidth - 20, 8.5, 'Helvetica');
      const boxHeight = 24 + decisionLines.length * 11 + (dec.evidenceFile ? 14 : 0);

      doc.ensureSpace(boxHeight + 8);

      // Card Box
      doc.drawRect(doc.margin, doc.currentY - boxHeight, doc.contentWidth, boxHeight, [0.99, 0.99, 0.99], doc.brandLightBorder, 0.5);

      // Status Badge
      const status = (dec.status || 'verified').toUpperCase();
      const statusColor = status === 'VERIFIED' ? doc.verifiedGreen : status === 'INFERRED' ? doc.inferredBlue : doc.amberWarning;
      const statusBg = status === 'VERIFIED' ? doc.verifiedGreenBg : status === 'INFERRED' ? doc.inferredBlueBg : doc.amberWarningBg;

      doc.drawText(dec.topic, doc.margin + 10, doc.currentY - 14, 'Helvetica-Bold', 9.5, doc.brandDark);
      doc.drawBadge(status, doc.pageWidth - doc.margin - 65, doc.currentY - 16, statusBg, statusColor, 'Helvetica-Bold', 7);

      let lineY = doc.currentY - 27;
      for (const line of decisionLines) {
        doc.drawText(line, doc.margin + 10, lineY, 'Helvetica', 8.5, [0.25, 0.25, 0.25]);
        lineY -= 11;
      }

      if (dec.evidenceFile) {
        doc.drawText(`Evidence: ${dec.evidenceFile}`, doc.margin + 10, lineY - 2, 'Courier', 7.5, doc.brandCrimson);
      }

      doc.currentY -= (boxHeight + 6);
    }
  }

  // ==========================================
  // 5. EXISTING FUNCTIONALITIES & MODULES
  // ==========================================
  const functionalities = summary.existingFunctionalities || [];
  doc.drawSectionHeader('Verified Functionalities & Modules', functionalities.length, 'Reconstructed business capabilities and fully/partially implemented modules.');

  if (functionalities.length === 0) {
    doc.drawParagraph('No implemented functionalities identified in source files.', doc.contentWidth, 8.5, doc.brandMuted);
    doc.currentY -= 6;
  } else {
    for (const fn of functionalities) {
      const descLines = wrapText(fn.description, doc.contentWidth - 20, 8.5, 'Helvetica');
      const filesCount = fn.filesInvolved?.length || 0;
      const filesText = filesCount > 0 ? `Files involved: ${fn.filesInvolved.slice(0, 4).join(', ')}${filesCount > 4 ? ` (+${filesCount - 4} more)` : ''}` : '';
      const boxHeight = 22 + descLines.length * 11 + (filesText ? 14 : 0);

      doc.ensureSpace(boxHeight + 8);

      doc.drawRect(doc.margin, doc.currentY - boxHeight, doc.contentWidth, boxHeight, [0.99, 0.99, 0.99], doc.brandLightBorder, 0.5);

      const isFull = fn.status === 'fully_implemented';
      const badgeText = isFull ? 'FULLY IMPLEMENTED' : 'PARTIAL';
      const badgeColor = isFull ? doc.verifiedGreen : doc.amberWarning;
      const badgeBg = isFull ? doc.verifiedGreenBg : doc.amberWarningBg;

      doc.drawText(fn.title, doc.margin + 10, doc.currentY - 14, 'Helvetica-Bold', 9, doc.brandDark);
      doc.drawBadge(badgeText, doc.pageWidth - doc.margin - 95, doc.currentY - 16, badgeBg, badgeColor, 'Helvetica-Bold', 7);

      let textY = doc.currentY - 26;
      for (const line of descLines) {
        doc.drawText(line, doc.margin + 10, textY, 'Helvetica', 8.5, [0.25, 0.25, 0.25]);
        textY -= 11;
      }

      if (filesText) {
        doc.drawText(filesText, doc.margin + 10, textY - 2, 'Courier', 7.5, doc.brandMuted);
      }

      doc.currentY -= (boxHeight + 6);
    }
  }

  // ==========================================
  // 6. UNFINISHED TASKS & TECHNICAL DEBT
  // ==========================================
  const unfinished = summary.unfinishedTasks || [];
  doc.drawSectionHeader('Unfinished Tasks, Stubs & Technical Debt', unfinished.length, 'Code stubs, TODO comments, and missing features identified across project source code.');

  if (unfinished.length === 0) {
    doc.drawParagraph('No pending tasks or technical debt markers detected.', doc.contentWidth, 8.5, doc.brandMuted);
    doc.currentY -= 6;
  } else {
    for (const task of unfinished) {
      const descLines = wrapText(task.description, doc.contentWidth - 20, 8.5, 'Helvetica');
      const boxHeight = 22 + descLines.length * 11 + (task.location ? 14 : 0);

      doc.ensureSpace(boxHeight + 8);

      doc.drawRect(doc.margin, doc.currentY - boxHeight, doc.contentWidth, boxHeight, [0.99, 0.99, 0.99], doc.brandLightBorder, 0.5);

      const pri = (task.priority || 'medium').toUpperCase();
      const priColor = pri === 'HIGH' ? doc.redDanger : pri === 'MEDIUM' ? doc.amberWarning : doc.brandMuted;
      const priBg = pri === 'HIGH' ? doc.redDangerBg : pri === 'MEDIUM' ? doc.amberWarningBg : [0.94, 0.94, 0.94] as RGB;

      doc.drawText(task.title, doc.margin + 10, doc.currentY - 14, 'Helvetica-Bold', 9, doc.brandDark);

      // Badges right
      let badgeRightX = doc.pageWidth - doc.margin - 50;
      doc.drawBadge(pri, badgeRightX, doc.currentY - 16, priBg, priColor, 'Helvetica-Bold', 7);

      if (task.type) {
        badgeRightX -= 55;
        doc.drawBadge(task.type, badgeRightX, doc.currentY - 16, [0.92, 0.92, 0.94], doc.brandDark, 'Helvetica-Bold', 7);
      }

      let textY = doc.currentY - 26;
      for (const line of descLines) {
        doc.drawText(line, doc.margin + 10, textY, 'Helvetica', 8.5, [0.25, 0.25, 0.25]);
        textY -= 11;
      }

      if (task.location) {
        doc.drawText(`Location: ${task.location}`, doc.margin + 10, textY - 2, 'Courier', 7.5, doc.brandCrimson);
      }

      doc.currentY -= (boxHeight + 6);
    }
  }

  // ==========================================
  // 7. TECHNICAL DOCUMENTATION & SYSTEM CONFIGURATION
  // ==========================================
  const techDocs = summary.technicalDocumentation || ({} as any);
  doc.drawSectionHeader('Technical Documentation & Specifications', undefined, 'Setup procedures, available scripts, environment configurations, and documented endpoints.');

  // Subsection 7A: Setup Instructions
  const setup = techDocs.setupInstructions || [];
  if (setup.length > 0) {
    doc.ensureSpace(35);
    doc.drawText('SETUP & INSTALLATION INSTRUCTIONS', doc.margin, doc.currentY, 'Helvetica-Bold', 8.5, doc.brandCrimson);
    doc.currentY -= 12;

    for (let i = 0; i < setup.length; i++) {
      const stepNum = `${i + 1}.`;
      doc.drawBulletItem(stepNum, setup[i], 16, 8.5, doc.brandDark);
    }
    doc.currentY -= 6;
  }

  // Subsection 7B: Available Scripts & Commands
  const scripts = techDocs.scripts || [];
  if (scripts.length > 0) {
    doc.ensureSpace(35);
    doc.drawText('AVAILABLE SCRIPTS & CLI COMMANDS', doc.margin, doc.currentY, 'Helvetica-Bold', 8.5, doc.brandCrimson);
    doc.currentY -= 14;

    for (const sc of scripts) {
      doc.ensureSpace(22);
      doc.drawRect(doc.margin, doc.currentY - 18, doc.contentWidth, 18, [0.97, 0.97, 0.97], doc.brandLightBorder, 0.5);
      doc.drawText(sc.command, doc.margin + 8, doc.currentY - 13, 'Courier', 8, doc.brandCrimson);
      const purposeText = sc.purpose || '';
      const pWidth = getTextWidth(purposeText, 8, 'Helvetica');
      doc.drawText(purposeText, doc.pageWidth - doc.margin - pWidth - 8, doc.currentY - 13, 'Helvetica', 8, doc.brandMuted);
      doc.currentY -= 22;
    }
    doc.currentY -= 6;
  }

  // Subsection 7C: Environment Variables
  const envVars = techDocs.environmentVariables || [];
  if (envVars.length > 0) {
    doc.ensureSpace(45);
    doc.drawText('REQUIRED & OPTIONAL ENVIRONMENT VARIABLES', doc.margin, doc.currentY, 'Helvetica-Bold', 8.5, doc.brandCrimson);
    doc.currentY -= 14;

    // Table Header
    doc.drawRect(doc.margin, doc.currentY - 16, doc.contentWidth, 16, [0.92, 0.92, 0.94], null);
    doc.drawText('KEY', doc.margin + 6, doc.currentY - 11, 'Helvetica-Bold', 7.5, doc.brandDark);
    doc.drawText('DESCRIPTION', doc.margin + 160, doc.currentY - 11, 'Helvetica-Bold', 7.5, doc.brandDark);
    doc.drawText('STATUS', doc.pageWidth - doc.margin - 55, doc.currentY - 11, 'Helvetica-Bold', 7.5, doc.brandDark);
    doc.currentY -= 16;

    for (const ev of envVars) {
      const descLines = wrapText(ev.description || 'Config parameter', doc.contentWidth - 230, 8, 'Helvetica');
      const rowHeight = Math.max(16, descLines.length * 10 + 6);

      doc.ensureSpace(rowHeight);
      doc.drawRect(doc.margin, doc.currentY - rowHeight, doc.contentWidth, rowHeight, null, doc.brandLightBorder, 0.25);

      doc.drawText(ev.key, doc.margin + 6, doc.currentY - 11, 'Courier', 7.5, doc.brandCrimson);

      let dY = doc.currentY - 11;
      for (const line of descLines) {
        doc.drawText(line, doc.margin + 160, dY, 'Helvetica', 7.5, doc.brandDark);
        dY -= 10;
      }

      const reqText = ev.required ? 'REQUIRED' : 'OPTIONAL';
      const reqColor = ev.required ? doc.brandCrimson : doc.brandMuted;
      doc.drawText(reqText, doc.pageWidth - doc.margin - 55, doc.currentY - 11, 'Helvetica-Bold', 7, reqColor);

      doc.currentY -= rowHeight;
    }
    doc.currentY -= 8;
  }

  // ==========================================
  // 8. DEPENDENCIES & RESPONSIBILITIES
  // ==========================================
  const dependencies = summary.dependencies || [];
  doc.drawSectionHeader('Dependencies & Architectural Responsibilities', dependencies.length, 'External libraries, runtime frameworks, and their designated roles in the architecture.');

  if (dependencies.length === 0) {
    doc.drawParagraph('No major package dependencies documented.', doc.contentWidth, 8.5, doc.brandMuted);
    doc.currentY -= 6;
  } else {
    // 2-column dependency cards
    const depCardW = (doc.contentWidth - 10) / 2;
    for (let i = 0; i < dependencies.length; i += 2) {
      const d1 = dependencies[i];
      const d2 = i + 1 < dependencies.length ? dependencies[i + 1] : null;

      doc.ensureSpace(38);

      // Card 1
      doc.drawRect(doc.margin, doc.currentY - 32, depCardW, 32, [0.99, 0.99, 0.99], doc.brandLightBorder, 0.5);
      doc.drawText(d1.name, doc.margin + 8, doc.currentY - 12, 'Courier', 8, doc.brandDark);
      if (d1.version) {
        doc.drawText(`v${d1.version}`, doc.margin + depCardW - 40, doc.currentY - 12, 'Helvetica', 7.5, doc.brandMuted);
      }
      doc.drawText(d1.purpose || 'System dependency', doc.margin + 8, doc.currentY - 24, 'Helvetica', 7.5, doc.brandMuted);

      // Card 2
      if (d2) {
        const d2X = doc.margin + depCardW + 10;
        doc.drawRect(d2X, doc.currentY - 32, depCardW, 32, [0.99, 0.99, 0.99], doc.brandLightBorder, 0.5);
        doc.drawText(d2.name, d2X + 8, doc.currentY - 12, 'Courier', 8, doc.brandDark);
        if (d2.version) {
          doc.drawText(`v${d2.version}`, d2X + depCardW - 40, doc.currentY - 12, 'Helvetica', 7.5, doc.brandMuted);
        }
        doc.drawText(d2.purpose || 'System dependency', d2X + 8, doc.currentY - 24, 'Helvetica', 7.5, doc.brandMuted);
      }

      doc.currentY -= 36;
    }
    doc.currentY -= 6;
  }

  // ==========================================
  // 9. DISCUSSIONS, COMMUNICATIONS & RECORDS
  // ==========================================
  const discussions = summary.discussionsAndCommunications || ({} as any);
  doc.drawSectionHeader('Discussions, Records & Historical Context', undefined, 'Analysis of architectural notes, meeting records, and historical communications.');

  const hasHistory = Boolean(discussions.hasHistoricalRecords);
  doc.ensureSpace(30);
  doc.drawText(
    `Historical Documentation Found: ${hasHistory ? 'YES (Documentation files, commit messages or meeting logs present)' : 'NO (Source code files only)'}`,
    doc.margin,
    doc.currentY,
    'Helvetica-Bold',
    8.5,
    hasHistory ? doc.verifiedGreen : doc.brandMuted
  );
  doc.currentY -= 14;

  if (discussions.notes?.length) {
    for (const note of discussions.notes) {
      doc.drawBulletItem('*', note, 12, 8.5, doc.brandDark);
    }
    doc.currentY -= 6;
  }

  // ==========================================
  // 10. FUTURE PLANS & STRATEGIC ACTIONS
  // ==========================================
  const futurePlans = summary.futurePlansAndActions || [];
  if (futurePlans.length > 0) {
    doc.drawSectionHeader('Future Plans & Strategic Roadmap Actions', futurePlans.length, 'Next development phases, recommended enhancements, and scaling milestones.');

    for (let i = 0; i < futurePlans.length; i++) {
      const planNumber = `${i + 1}.`;
      doc.drawBulletItem(planNumber, futurePlans[i], 16, 8.5, doc.brandCrimson);
    }
    doc.currentY -= 6;
  }

  // ==========================================
  // 11. CONTRADICTIONS & UNRESOLVED GAPS (IF ANY)
  // ==========================================
  const missingInfo = summary.missingOrContradictoryInformation || [];
  if (missingInfo.length > 0) {
    doc.drawSectionHeader('Missing or Contradictory Information Detected', missingInfo.length, 'Discrepancies identified between project documentation and source code implementation.');

    for (const item of missingInfo) {
      doc.drawBulletItem('[!]', item, 14, 8.5, doc.amberWarning);
    }
    doc.currentY -= 6;
  }

  // ==========================================
  // GENERATE PDF BYTES & TRIGGER DOWNLOAD
  // ==========================================
  const pdfBytes = doc.buildPdfBytes();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const sanitizedFilename = `ErNEXA_Summary_${resolvedProjectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = sanitizedFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke URL after small delay
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 2000);
}
