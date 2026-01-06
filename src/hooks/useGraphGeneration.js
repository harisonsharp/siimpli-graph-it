// DEPRECATED (not used)

import { useCallback } from 'react';
import * as d3 from 'd3';
import { GRAPH_CONFIG, parseColumnId, drawAxes, drawColorLegend, drawContourLegend, generateContours } from '@siimpli/graph-it-core';
import { useError } from '../contexts/ErrorContext.jsx';
import { generateCustomBins } from '@siimpli/graph-it-core';
/**
 * @fileoverview React hook for generating scientific data visualization graphs using D3.js.
 * Provides comprehensive graph generation capabilities including scatter plots, color gradients,
 * contour lines, legends, and custom axis positioning for curve fitting analysis.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @module useGraphGeneration
 *
 * @description This custom React hook manages the core graph generation logic for the scientific
 * data visualization tool. It handles D3.js-based rendering, coordinate system transformations,
 * and interactive graph features including color grading and contour plotting.
 *
 * @requires d3 - D3.js library for data visualization and DOM manipulation
 * @requires constants.js - Graph configuration constants and defaults
 * @requires graphUtils.js - Utility functions for axes, legends, and contour generation
 * @requires ErrorContext.jsx - Application error handling context
 *
 * @param {Object} logoImage - Optional logo image object for graph branding
 * @returns {Object} Hook object containing generateGraph function
 *
 * @example
 * const { generateGraph } = useGraphGeneration(logoImage);
 * generateGraph(csvData, config, svgRef, globalSettings, colorSchemes, getAxisIntercepts);
 *
 * @relatedFiles SvgPlottingService.js, constants.js, PlotControlsCard.jsx
 */

export const useGraphGeneration = (logoImage) => {
    const { handleError } = useError();



    const generateGraph = useCallback((csvData, config, svgRef, globalSettings, colorSchemes, getAxisIntercepts) => {

        try {
            if (!config.xAxis || csvData.length === 0) {
                throw new Error('Missing required data or configuration');
            }
            if (config.graphType == 'histogram') {
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();

                const { MARGINS } = GRAPH_CONFIG;
                const width = globalSettings.graphDimensions.width - MARGINS.left - MARGINS.right;
                const height = globalSettings.graphDimensions.height - MARGINS.top - MARGINS.bottom;

                const values = csvData
                    .map(d => +d[config.xAvis])
                    .filter(v => !isNaN(v));

                if (!values || values.length == 0) {
                    throw new Error("No valid data points for histogram")
                }




                const bins = generateCustomBins(values);
                const normalBins = bins.filter(b => !b.isOutlierBin);
                const outlierBin = bins.filter(b => b.isOutlierBin);
                // We can do some colouring of the bins corresponding to confidence here if that is implemented
                const x = d3.scaleLinear()
                    .domain([d3.min(normalBins, b => b.min), d3.max(normalBins, b => b.max)])
                import { useRef, useCallback } from 'react';
                import { useGraphRenderer } from './useGraphRenderer.js';

                export const useGraphGeneration = (logoImage) => {
                    const { handleError } = useError();
                    const hasWarnedRef = useRef(false);

                    if (!hasWarnedRef.current && typeof window !== 'undefined') {
                        console.warn('[DEPRECATED] useGraphGeneration is deprecated. Switch to useGraphRenderer or useBatchGraphRenderer.');
                        hasWarnedRef.current = true;
                    }

                    const { generateGraph } = useGraphRenderer({
                        csvData: [],
                        graphConfig: {},
                        curveFits: [],
                        globalSettings: { graphDimensions: { width: 800, height: 600 }, colorScheme: 'warm-cool' },
                        logoImage,
                        logoReady: true,
                        getAxisIntercepts: () => ({ x: 0, y: 0 }),
                        colorSchemes: {},
                        isBatchMode: true
                    });

                    const legacyGenerateGraph = useCallback((csvData, config, svgRef, globalSettings, colorSchemes, getAxisIntercepts) => {
                        try {
                            return generateGraph(
                                svgRef,
                                null,
                                (error) => handleError(error, 'Failed to generate graph'),
                                {
                                    csvData,
                                    graphConfig: config,
                                    globalSettings,
                                    colorSchemes,
                                    logoImage,
                                    logoReady: true,
                                    curveFits: config.curveFits || [],
                                    isBatchMode: true
                                }
                            );
                        } catch (error) {
                            handleError(error, 'Failed to generate graph');
                            return false;
                        }
                    }, [generateGraph, handleError, logoImage]);

                    return { generateGraph: legacyGenerateGraph };
                };
                    .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "24px")
        .style("font-family", "sans-serif")
        .style("font-weight", "bold")
        .text(title);

    // Add logo if available
    if (logoImage) {
        const logoX = 0 - GRAPH_CONFIG.LOGO_SIZE;
        const logoY = height + 10;
        svg.append("image")
            .attr("xlink:href", logoImage.src)
            .attr("x", MARGINS.left + logoX)
            .attr("y", MARGINS.top + logoY)
            .attr("width", GRAPH_CONFIG.LOGO_SIZE)
            .attr("height", GRAPH_CONFIG.LOGO_SIZE)
            .attr("opacity", 0.8);
    }

    return true;
}

            else {
    if (!config.xAxis || !config.yAxis || csvData.length === 0) {
        throw new Error('Missing required data or configuration');
    }
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { MARGINS } = GRAPH_CONFIG;
    const width = globalSettings.graphDimensions.width - MARGINS.left - MARGINS.right;
    const height = globalSettings.graphDimensions.height - MARGINS.top - MARGINS.bottom;

    // Filter valid data
    const validData = csvData.filter(d =>
        d[config.xAxis] !== undefined &&
        d[config.yAxis] !== undefined &&
        !isNaN(+d[config.xAxis]) &&
        !isNaN(+d[config.yAxis])
    );

    if (validData.length === 0) {
        throw new Error('No valid data points found');
    }

    // Get data extents
    const xExtent = d3.extent(validData, d => +d[config.xAxis]);
    const yExtent = d3.extent(validData, d => +d[config.yAxis]);

    // Get axis intercepts
    const intercepts = getAxisIntercepts(xExtent, yExtent, config);

    // Adjust domain to include intercept points
    const xDomain = [
        Math.min(xExtent[0], intercepts.x),
        Math.max(xExtent[1], intercepts.x)
    ];
    const yDomain = [
        Math.min(yExtent[0], intercepts.y),
        Math.max(yExtent[1], intercepts.y)
    ];

    // Scales
    const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
    const yScale = d3.scaleLinear().domain(yDomain).range([height, 0]);

    // Color scale
    let colorScale;
    if (config.colorGrading) {
        const colorValues = validData.map(d => d[config.colorGrading]).filter(v => v !== undefined);
        if (colorValues.length > 0) {
            if (typeof colorValues[0] === 'string') {
                const uniqueValues = [...new Set(colorValues)];
                const colors = d3.schemeCategory10.slice(0, Math.min(uniqueValues.length, 10));
                colorScale = d3.scaleOrdinal().domain(uniqueValues).range(colors);
            } else {
                colorScale = d3.scaleSequential(colorSchemes[globalSettings.colorScheme])
                    .domain(d3.extent(colorValues));
            }
        }
    }

    const g = svg.append("g").attr("transform", `translate(${MARGINS.left},${MARGINS.top})`);

    // Add title
    const title = config.title || `${config.xAxis} vs ${config.yAxis}${config.colorGrading ? ` vs ${config.colorGrading}` : ''}${config.contouring ? ` vs ${config.contouring}` : ''}`;
    svg.append("text")
        .attr("x", globalSettings.graphDimensions.width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "24px")
        .style("font-family", "sans-serif")
        .style("font-weight", "bold")
        .text(title);

    // Calculate axis positions based on intercepts
    const xAxisY = yScale(intercepts.y);
    const yAxisX = xScale(intercepts.x);

    // Draw axes using utility function
    drawAxes(
        g,
        xScale,
        yScale,
        xAxisY,
        yAxisX,
        height,
        width,
        MARGINS,
        config.xAxis,
        config.yAxis,
        config.graphType || 'scatter'
    );
    // Add logo if available
    if (logoImage) {
        const logoX = 0 - GRAPH_CONFIG.LOGO_SIZE;
        const logoY = height + 10;
        svg.append("image")
            .attr("xlink:href", logoImage.src)
            .attr("x", MARGINS.left + logoX)
            .attr("y", MARGINS.top + logoY)
            .attr("width", GRAPH_CONFIG.LOGO_SIZE)
            .attr("height", GRAPH_CONFIG.LOGO_SIZE)
            .attr("opacity", 0.8);
    }

    // Plot data points
    g.selectAll(".dot")
        .data(validData)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 3)
        .attr("cx", d => xScale(+d[config.xAxis]))
        .attr("cy", d => yScale(+d[config.yAxis]))
        .style("fill", d => {
            if (config.colorGrading && colorScale && d[config.colorGrading] !== undefined) {
                return colorScale(d[config.colorGrading]);
            }
            return "steelblue";
        })
        .style("opacity", 0.7);

    // Add contours if specified
    if (config.contouring) {
        const contourData = validData.filter(d =>
            d[config.contouring] !== undefined && !isNaN(+d[config.contouring])
        );

        if (contourData.length > 3) {
            const { contours, thresholds } = generateContours(
                contourData, config.xAxis, config.yAxis, config.contouring, xScale, yScale
            );

            // Draw contour lines
            const contourGroup = g.append("g").attr("class", "contours");
            const contourColorScale = d3.scaleSequential(d3.interpolateViridis)
                .domain([0, thresholds.length - 1]);

            contours.forEach((contour, i) => {
                const contourPath = d3.geoPath();
                contourGroup.append("path")
                    .datum(contour)
                    .attr("d", contourPath)
                    .attr("fill", "none")
                    .attr("stroke", contourColorScale(i))
                    .attr("stroke-width", 1.5)
                    .attr("stroke-opacity", 0.7);
            });

            // Draw contour legend
            drawContourLegend(svg, { columnName: config.contouring }, thresholds, contourColorScale, globalSettings.graphDimensions);
        }
    }

    // Add legend for color grading

    if (config.colorGrading && colorScale) {
        const colorValues = validData.map(d => d[config.colorGrading]).filter(v => v !== undefined);
        drawColorLegend(svg, colorScale, colorValues, { columnName: config.colorGrading }, MARGINS, globalSettings.graphDimensions, config.colorScheme || globalSettings.colorScheme);
    }

    return true;
}
        } catch (error) {
    handleError(error, 'Failed to generate graph');
    return false;
}
    }, [handleError, logoImage]);

return { generateGraph };
};
