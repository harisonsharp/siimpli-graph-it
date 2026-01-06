import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { useGraphRenderer } from '../hooks/useGraphRenderer.js';
import { debugWarn } from '@siimpli/graph-it-core';
/**
 * @fileoverview Simplified graph rendering component using D3.js for scientific data visualization.
 * Presentation-focused component that delegates business logic to useGraphRenderer hook.
 * Renders interactive SVG-based graphs with comprehensive visualization features.
 *
 * @author Harison Sharp
 * @since 0.3.0 (Refactored from 0.2.0)
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library with hooks (useRef, useEffect)
 * @requires d3 - D3.js color schemes for visualization
 * @requires ./useGraphRenderer - Custom hook for graph generation logic
 *
 * @param {Object} props - Component props
 * @param {Array} props.csvData - Processed CSV data for visualization
 * @param {Object} props.graphConfig - Graph configuration and settings
 * @param {Array} props.curveFits - Curve fitting results and parameters
 * @param {Object} props.globalSettings - Application-wide settings
 * @param {Image} props.logoImage - Logo image for branding
 * @param {boolean} props.logoReady - Logo loading state
 * @param {Function} props.getAxisIntercepts - Function to calculate axis intercepts
 * @param {Function} props.onGraphGenerated - Callback for graph generation status
 * @param {React.RefObject} props.svgRef - Optional external SVG ref for export functionality
 * @param {React.RefObject} props.canvasRef - Optional external canvas ref for export functionality
 *
 * @exports default GraphRenderer
 *
 * @example
 * <GraphRenderer 
 *   csvData={data} 
 *   graphConfig={config} 
 *   onGraphGenerated={setStatus}
 * />
 *
 * @related useGraphRenderer.js, GraphService.js, GraphConfiguration.jsx, GraphApp.jsx
 */

// Define color schemes outside component to prevent unnecessary re-creation
const COLOR_SCHEMES = {
    'warm-cool': d3.interpolateRdYlBu,
    'green-red': d3.interpolateRdYlGn,
    'rainbow': d3.interpolateRainbow,
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
    canvasRef: externalCanvasRef
}) => {
    const internalSvgRef = useRef();
    const internalCanvasRef = useRef();
    const hasGeneratedRef = useRef(false); // Prevent double generation

    // Use external refs if provided, otherwise use internal refs
    const svgRef = externalSvgRef || internalSvgRef;
    const canvasRef = externalCanvasRef || internalCanvasRef;

    // Store callback in ref to avoid dependency changes
    const onGraphGeneratedRef = useRef(onGraphGenerated);
    onGraphGeneratedRef.current = onGraphGenerated;

    // Initialize graph renderer hook with configuration
    const { generateGraph } = useGraphRenderer({
        csvData,
        graphConfig,
        curveFits,
        globalSettings,
        logoImage,
        logoReady,
        getAxisIntercepts,
        colorSchemes: COLOR_SCHEMES
    });

    // Store generateGraph in ref to avoid effect re-runs
    const generateGraphRef = useRef(generateGraph);
    generateGraphRef.current = generateGraph;

    // Trigger graph generation ONCE on mount
    useEffect(() => {
        if (hasGeneratedRef.current) return;
        hasGeneratedRef.current = true;

        generateGraphRef.current(
            svgRef,
            (result) => onGraphGeneratedRef.current(result),
            (error) => {
                debugWarn('Graph generation failed:', error);
                onGraphGeneratedRef.current(false);
            }
        );
    }, []); // Empty deps - run once on mount

    return (
        <div className="graph-container">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${globalSettings.graphDimensions.width} ${globalSettings.graphDimensions.height}`}
                className="graph-canvas"
            />
            <canvas
                ref={canvasRef}
                width={globalSettings.graphDimensions.width}
                height={globalSettings.graphDimensions.height}
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default GraphRenderer;
