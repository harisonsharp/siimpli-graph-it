/**
 * @fileoverview Simplified graph rendering component using D3.js for scientific data visualization.
 * Presentation-focused component that delegates business logic to useGraphRenderer and zoom/pan
 * behaviour to useGraphZoom.
 *
 * @author Harison Sharp
 * @since 0.3.0 (Refactored from 0.2.0)
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @related useGraphRenderer.js, useGraphZoom.js, GraphService.js, GraphConfiguration.jsx, GraphApp.jsx
 */

import { useEffect, useRef, useState } from 'react';
import { debugWarn } from '@siimpli/graph-it-core';
import * as d3 from 'd3';
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useGraphRenderer } from '../hooks/useGraphRenderer.js';
import { useGraphZoom, MAX_ZOOM, MIN_ZOOM } from '../hooks/useGraphZoom.js';

// Define color schemes outside component to prevent unnecessary re-creation
const COLOR_SCHEMES = {
    'warm-cool': d3.interpolateRdYlBu,
    'green-red': d3.interpolateRdYlGn,
    'rainbow':   d3.interpolateRainbow,
};

const GraphRenderer = ({
    csvData,
    graphConfig,
    curveFits,
    globalSettings,
    logoImage,
    logoReady,
    getAxisIntercepts,
    onGraphGenerated,
    svgRef: externalSvgRef,
    canvasRef: externalCanvasRef,
    updateGlobalSettings
}) => {
    const internalSvgRef    = useRef();
    const internalCanvasRef = useRef();
    const [dimensions, setDimensions] = useState(globalSettings.graphDimensions);
    const [graphReady, setGraphReady] = useState(false);

    // Keep a stable ref to the latest config so the zoom hook can read log-axis
    // flags without needing to be re-initialised on every config change.
    const graphConfigRef = useRef(graphConfig);
    graphConfigRef.current = graphConfig;

    // Use external refs if provided, otherwise fall back to internal ones
    const svgRef    = externalSvgRef    || internalSvgRef;
    const canvasRef = externalCanvasRef || internalCanvasRef;

    // Store callback in ref to avoid dependency changes
    const onGraphGeneratedRef = useRef(onGraphGenerated);
    onGraphGeneratedRef.current = onGraphGenerated;

    // -----------------------------------------------------------------------
    // Graph rendering hook
    // -----------------------------------------------------------------------
    const { generateGraph } = useGraphRenderer({
        csvData,
        graphConfig,
        curveFits,
        globalSettings,
        logoImage,
        logoReady,
        getAxisIntercepts,
        colorSchemes: COLOR_SCHEMES,
        onXValueSelect: (value) => updateGlobalSettings({ selectedXValue: value })
    });

    // Store generateGraph in a ref so the mount-effect closure stays stable
    const generateGraphRef = useRef(generateGraph);
    generateGraphRef.current = generateGraph;

    // -----------------------------------------------------------------------
    // Zoom / pan hook — owns all D3 zoom state and DOM manipulation
    // -----------------------------------------------------------------------
    const {
        setupZoom,
        zoomIn,
        zoomOut,
        resetZoom,
        zoomLevel,
        isPanning,
    } = useGraphZoom(svgRef, graphConfigRef);

    // Stable ref so the mount-effect can call setupZoom without a dependency
    const setupZoomRef = useRef(setupZoom);
    setupZoomRef.current = setupZoom;

    // -----------------------------------------------------------------------
    // Trigger graph generation once on mount, then wire up zoom
    // -----------------------------------------------------------------------
    useEffect(() => {
        generateGraphRef.current(
            svgRef,
            (result) => {
                if (result.finalDimensions) {
                    setDimensions(result.finalDimensions);
                }

                // Extract scale objects and plot dimensions for the zoom hook
                if (result.scales && result.dimensions) {
                    const rawY = result.scales.yScale;
                    const isDualAxis = rawY && typeof rawY === 'object' && rawY.primary;

                    const scales = {
                        xScale:  result.scales.xScale,
                        yScale:  isDualAxis ? rawY.primary   : rawY,
                        yScale2: isDualAxis ? rawY.secondary : null,
                    };
                    const plotDims = {
                        width:  result.dimensions.width,
                        height: result.dimensions.height,
                    };

                    setupZoomRef.current(scales, plotDims);
                }

                onGraphGeneratedRef.current(result);
                setGraphReady(true);
            },
            (error) => {
                debugWarn('Graph generation failed:', error);
                onGraphGeneratedRef.current(false);
            }
        );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally run once on mount

    const isZoomed = zoomLevel !== 1;

    return (
        <div
            className="graph-container"
            style={{ overflow: 'auto', maxWidth: '100%', maxHeight: '100%', position: 'relative' }}
        >
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                className="graph-canvas"
                style={{ cursor: isPanning ? 'grabbing' : undefined }}
            />
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{ display: 'none' }}
            />

            {/* Zoom controls — only shown after graph is ready */}
            {graphReady && (
                <div className="zoom-controls" role="toolbar" aria-label="Zoom controls">
                    <button
                        type="button"
                        className="zoom-btn"
                        onClick={zoomIn}
                        disabled={zoomLevel >= MAX_ZOOM}
                        title="Zoom in (scroll wheel also works)"
                        aria-label="Zoom in"
                    >
                        <ZoomIn size={16} />
                    </button>

                    <div className="zoom-level" title="Current zoom level" aria-live="polite">
                        <span className="sr-only">Zoom level: </span>
                        {Math.round(zoomLevel * 100)}%
                    </div>

                    <button
                        type="button"
                        className="zoom-btn"
                        onClick={zoomOut}
                        disabled={zoomLevel <= MIN_ZOOM}
                        title="Zoom out"
                        aria-label="Zoom out"
                    >
                        <ZoomOut size={16} />
                    </button>

                    {isZoomed && (
                        <button
                            type="button"
                            className="zoom-btn zoom-btn--reset"
                            onClick={resetZoom}
                            title="Reset zoom to 100%"
                            aria-label="Reset zoom"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}

                    {isPanning && (
                        <div className="zoom-panning-indicator" aria-hidden="true">
                            <Move size={12} />
                        </div>
                    )}
                </div>
            )}

            {/* Pan hint — shown only when not yet zoomed */}
            {graphReady && !isZoomed && (
                <div className="zoom-hint" aria-hidden="true">
                    Scroll to zoom · Drag to pan
                </div>
            )}
        </div>
    );
};

export default GraphRenderer;
