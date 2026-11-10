import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Download, Code, Eye, Copy, Check, Maximize2 } from 'lucide-react';

interface MermaidViewerProps {
  chart: string;
  title?: string;
  id?: string;
}

// Initialize Mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis',
  },
});

export const MermaidViewer: React.FC<MermaidViewerProps> = ({ chart, title = 'Diagram', id = 'mermaid-chart' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showCode, setShowCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const cleanChart = chart.trim().replace(/^```mermaid\s*/i, '').replace(/^```\s*/, '').replace(/```$/i, '').trim();

  useEffect(() => {
    let isMounted = true;
    const uniqueId = `mermaid-${id}-${Math.random().toString(36).substring(2, 9)}`;

    async function renderChart() {
      if (!cleanChart) {
        setSvgContent('');
        return;
      }
      try {
        setRenderError(null);
        const { svg } = await mermaid.render(uniqueId, cleanChart);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: any) {
        console.warn('Mermaid rendering error:', err);
        if (isMounted) {
          setRenderError(err.message || 'Unable to render Mermaid diagram');
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
      const element = document.getElementById(uniqueId);
      if (element) element.remove();
    };
  }, [cleanChart, id]);

  // Auto-fit diagram to container after rendering
  useEffect(() => {
    if (!svgContent) return;
    const timer = setTimeout(() => {
      handleFitToFrame();
    }, 150);
    return () => clearTimeout(timer);
  }, [svgContent]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.3));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToFrame = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    const container = containerRef.current;
    if (!svgEl || !container) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    try {
      const bBox = svgEl.getBBox();
      const svgWidth = bBox.width > 0 ? bBox.width : (svgEl.viewBox?.baseVal?.width || 800);
      const svgHeight = bBox.height > 0 ? bBox.height : (svgEl.viewBox?.baseVal?.height || 500);
      const containerWidth = Math.max(container.clientWidth - 48, 200);
      const containerHeight = Math.max(container.clientHeight - 48, 200);

      const scaleX = containerWidth / svgWidth;
      const scaleY = containerHeight / svgHeight;
      const optimalZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.2);

      setZoom(Math.round(optimalZoom * 100) / 100);
      setPan({ x: 0, y: 0 });
    } catch {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (showCode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Mobile Touch Pan Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showCode || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const copyCode = () => {
    navigator.clipboard.writeText(cleanChart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPreparedSvgElement = (): SVGSVGElement | null => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return null;

    let minX = 0;
    let minY = 0;
    let width = 800;
    let height = 600;

    try {
      const bBox = svgEl.getBBox();
      if (bBox && bBox.width > 0 && bBox.height > 0) {
        minX = bBox.x;
        minY = bBox.y;
        width = bBox.width;
        height = bBox.height;
      } else if (svgEl.viewBox?.baseVal && svgEl.viewBox.baseVal.width > 0) {
        minX = svgEl.viewBox.baseVal.x;
        minY = svgEl.viewBox.baseVal.y;
        width = svgEl.viewBox.baseVal.width;
        height = svgEl.viewBox.baseVal.height;
      }
    } catch {
      if (svgEl.viewBox?.baseVal && svgEl.viewBox.baseVal.width > 0) {
        minX = svgEl.viewBox.baseVal.x;
        minY = svgEl.viewBox.baseVal.y;
        width = svgEl.viewBox.baseVal.width;
        height = svgEl.viewBox.baseVal.height;
      }
    }

    const padding = 50;
    const exportX = Math.floor(minX - padding);
    const exportY = Math.floor(minY - padding);
    const exportWidth = Math.ceil(width + padding * 2);
    const exportHeight = Math.ceil(height + padding * 2);

    const cloned = svgEl.cloneNode(true) as SVGSVGElement;
    cloned.removeAttribute('style');
    cloned.setAttribute('viewBox', `${exportX} ${exportY} ${exportWidth} ${exportHeight}`);
    cloned.setAttribute('width', `${exportWidth}`);
    cloned.setAttribute('height', `${exportHeight}`);
    cloned.setAttribute('style', `width: ${exportWidth}px; height: ${exportHeight}px; background-color: #FFFFFF;`);
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return cloned;
  };

  const downloadSvg = () => {
    const preparedSvg = getPreparedSvgElement();
    if (!preparedSvg) {
      if (!svgContent) return;
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }
    const svgString = new XMLSerializer().serializeToString(preparedSvg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    const preparedSvg = getPreparedSvgElement();
    if (!preparedSvg) return;

    const width = parseFloat(preparedSvg.getAttribute('width') || '1200');
    const height = parseFloat(preparedSvg.getAttribute('height') || '800');
    const scale = 2; // 2x high-resolution
    const canvasWidth = Math.round(width * scale);
    const canvasHeight = Math.round(height * scale);

    const svgString = new XMLSerializer().serializeToString(preparedSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
        const png = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = png;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  return (
    <div className="flex flex-col border border-brand-border rounded-xl bg-white overflow-hidden shadow-sm">
      {/* Diagram Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 border-b border-brand-border bg-brand-bg/50">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-brand-dark">{title}</span>
          <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-brand-secondary/30 text-brand-dark font-medium">
            Mermaid.js
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {/* Zoom Controls */}
          {!showCode && (
            <div className="flex items-center gap-0.5 sm:gap-1 bg-white border border-brand-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-1 text-brand-muted hover:text-brand-dark hover:bg-brand-bg rounded transition"
              >
                <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-1 text-brand-muted hover:text-brand-dark hover:bg-brand-bg rounded transition"
              >
                <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset View"
                className="p-1 text-brand-muted hover:text-brand-dark hover:bg-brand-bg rounded transition"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitToFrame}
                title="Fit Diagram to Frame"
                className="p-1 text-brand-muted hover:text-brand-dark hover:bg-brand-bg rounded transition flex items-center gap-1 text-[11px] px-1.5"
              >
                <Maximize2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span className="text-[10px] sm:text-[11px]">Fit</span>
              </button>
              <span className="text-[10px] sm:text-xs px-1 text-brand-muted font-mono">{Math.round(zoom * 100)}%</span>
            </div>
          )}

          {/* Toggle Code / Diagram */}
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-xs px-2 sm:px-2.5 py-1.5 rounded-lg border border-brand-border bg-white text-brand-dark hover:bg-brand-bg transition active:scale-95"
          >
            {showCode ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{showCode ? 'View Diagram' : 'Mermaid Code'}</span>
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={copyCode}
            title="Copy Mermaid Code"
            className="p-1.5 rounded-lg border border-brand-border bg-white text-brand-muted hover:text-brand-dark hover:bg-brand-bg transition active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Download Menu */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-brand-border rounded-lg shadow-lg py-1 hidden group-hover:block z-20">
              <button
                type="button"
                onClick={downloadSvg}
                className="w-full text-left px-3 py-1.5 text-xs text-brand-dark hover:bg-brand-bg transition"
              >
                Download SVG
              </button>
              <button
                type="button"
                onClick={downloadPng}
                className="w-full text-left px-3 py-1.5 text-xs text-brand-dark hover:bg-brand-bg transition"
              >
                Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`relative min-h-[320px] sm:min-h-[420px] max-h-[620px] overflow-hidden flex items-center justify-center p-3 sm:p-6 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } ${showCode ? 'bg-stone-900 cursor-auto' : 'bg-[#FAF7F2]'}`}
      >
        {renderError ? (
          <div className="text-center p-6 max-w-lg bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-800 mb-2">Diagram Rendering Notice</p>
            <p className="text-xs text-red-600 mb-3 font-mono">{renderError}</p>
            <button
              type="button"
              onClick={() => setShowCode(true)}
              className="text-xs px-3 py-1.5 bg-red-800 text-white rounded-lg hover:bg-red-900"
            >
              Inspect Raw Code
            </button>
          </div>
        ) : showCode ? (
          <div className="w-full h-full p-4 overflow-auto">
            <pre className="text-xs text-amber-200 font-mono whitespace-pre">{cleanChart}</pre>
          </div>
        ) : (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            className="select-none inline-block"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>
    </div>
  );
};

