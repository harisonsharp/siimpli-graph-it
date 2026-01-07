/**
 * @fileoverview Custom React hook for graph rendering orchestration.
 * Encapsulates graph generation business logic including data validation, scale creation,
 * axis calculation, series rendering, and legend generation.
 *
 * @author Harison Sharp
 * @since 0.3.0
 *
 * @module useGraphRenderer
 * @requires react - useCallback hook for memoization
 * @requires d3 - Data visualization library
 * @requires @siimpli/graph-it-core - SiimpliGraphIt core library
 *
 * @exports useGraphRenderer
 *
 * @example
 * const { generateGraph } = useGraphRenderer({
 *   csvData,
 *   graphConfig,
 *   curveFits,
 *   globalSettings,
 *   logoImage,
 *   logoReady,
 *   getAxisIntercepts,
 *   colorSchemes
 * });
 *
 * generateGraph(svgRef, onSuccess, onError);
 */

import { useCallback } from 'react';
import * as d3 from 'd3';
import {
    GraphService,
    FileService,
    parseColumnId,
    drawAxes,
    drawColorLegend,
    drawContourLegend,
    drawSeriesLegend,
    renderLogo,
    generateTitle,
    ScaleFactory,
    CanvasSizer,
    groupSeriesByAxis,
    getAxisColor,
    getAxisLabel,
    aggregateData,
    debugLog,
    debugWarn
} from '@siimpli/graph-it-core';


/**
 * Custom hook for graph rendering logic
 * 
 * @param {Object} config - Hook configuration
 * @param {Array} config.csvData - Processed CSV data for visualization
 * @param {Object} config.graphConfig - Graph configuration and settings
 * @param {Array} config.curveFits - Curve fitting results
 * @param {Object} config.globalSettings - Application-wide settings
 * @param {Image} config.logoImage - Logo image for branding
 * @param {boolean} config.logoReady - Logo loading state
 * @param {Function} config.getAxisIntercepts - Axis intercept calculator
 * @param {Object} config.colorSchemes - Available color schemes
 * @returns {Object} Hook interface with generateGraph function
 */
export function useGraphRenderer({
    csvData,
    graphConfig,
    curveFits = [],
    globalSettings,
    logoImage = null,
    logoReady = true,
    getAxisIntercepts,
    getAxisIntercepts,
    colorSchemes,
    isBatchMode = false,
    onXValueSelect
}) {
    /**
     * Parse column identifiers from configuration
     * 
     * @param {Object} config - Graph configuration
     * @returns {Object} Parsed column information
     */
    const parseColumnInformation = useCallback((config) => {
        const graphType = (config?.graphType || 'scatter').toLowerCase();
        const xAxisInfo = parseColumnId(config.xAxis);
        const xAxis2Info = config.xAxis2 ? parseColumnId(config.xAxis2) : null;

        const baseSeries = Array.isArray(config.series) ? config.series : [];
        const seriesInfo = graphType === 'histogram'
            ? []
            : baseSeries
                .map(s => ({
                    ...s,
                    yAxisInfo: parseColumnId(s.yAxis)
                }))
                .filter(s => s.yAxisInfo.columnName);

        const colorInfo = parseColumnId(config.colorGrading);
        const contourInfo = graphType === 'histogram' ? null : parseColumnId(config.contouring);

        return { xAxisInfo, xAxis2Info, seriesInfo, colorInfo, contourInfo, graphType };
    }, []);

    /**
     * Calculate layout dimensions based on global settings
     * 
     * @param {Object} settings - Global settings with graphDimensions
     * @returns {Object} Margin and calculated dimensions
     */
    /**
     * Calculate layout dimensions based on global settings and graph content
     * 
     * @param {Object} settings - Global settings with graphDimensions
     * @param {Object} columnInfo - Parsed column information for legend sizing
     * @param {Object} graphConfig - Graph configuration for axis checks
     * @returns {Object} Margin and calculated dimensions
     */
    const calculateDimensions = useCallback((settings, columnInfo, graphConfig) => {
        // Calculate dynamic right margin based on legend content
        let rightMargin = 60; // Base spacing

        // 1. Calculate Legend Width
        if (columnInfo && columnInfo.seriesInfo) {
            const longestLabel = columnInfo.seriesInfo.reduce((max, series) => {
                const label = series.yAxisInfo.columnName || '';
                return label.length > max.length ? label : max;
            }, '');

            // Approx 7px per character for 12px font + 40px for swatch and padding
            const estimatedLegendWidth = (longestLabel.length * 7) + 40;
            rightMargin += estimatedLegendWidth;
        }

        // 2. Add space for Secondary Axis Label if needed
        const hasSecondaryAxis = graphConfig.series && graphConfig.series.some(s => s.axisAssignment === 'secondary');
        if (hasSecondaryAxis) {
            rightMargin += 50; // Space for axis ticks and label
        }

        // 3. Add extra width for Static Table values if enabled
        if (settings.showStaticTable) {
            rightMargin += 60; // Extra space for values "123.45"
        }

        // Clamp margin to reasonable bounds (min 120, max 450)
        rightMargin = Math.max(120, Math.min(450, rightMargin));

        // Adjust top margin for Project Name
        const topMargin = graphConfig.projectName ? 110 : 80;

        const margin = { top: topMargin, right: rightMargin, bottom: 100, left: 100 };
        const width = settings.graphDimensions.width - margin.left - margin.right;
        const height = settings.graphDimensions.height - margin.top - margin.bottom;

        return { margin, width, height };
    }, []);

    /**
     * Create scales for x-axis, y-axis, colors, and series
     * 
     * @param {Array} validData - Filtered valid data points
     * @param {Object} columnInfo - Parsed column information
     * @param {Object} dimensions - Layout dimensions
     * @param {Object} config - Graph configuration
     * @param {Object} settings - Global settings with colorScheme
     * @returns {Object} Created scales
     */
    const createScales = useCallback((validData, columnInfo, dimensions, config, settings) => {
        const { xAxisInfo, seriesInfo, colorInfo, graphType } = columnInfo;
        const { width, height } = dimensions;

        const { xScale, yScale } = ScaleFactory.createScalesForGraph(
            validData,
            xAxisInfo,
            seriesInfo,
            width,
            height,
            config
        );

        debugLog('[useGraphRenderer] Creating color scale with scheme:', settings.colorScheme);
        const colorScale = ScaleFactory.createColorScale(
            validData,
            colorInfo,
            settings.colorScheme
        );

        // Use yAxisInfo.columnName for series color scale
        const seriesNames = seriesInfo.map(s => s.yAxisInfo.columnName).filter(Boolean);
        debugLog('[useGraphRenderer] Creating series color scale for:', seriesNames);
        const seriesColorScale = seriesNames.length > 0
            ? ScaleFactory.createSeriesColorScale(seriesNames, seriesInfo)
            : null;

        return { xScale, yScale, colorScale, seriesColorScale };
    }, []);

    /**
     * Render graph title
     * 
     * @param {d3.Selection} svg - SVG element selection
     * @param {Object} config - Graph configuration
     * @param {Object} columnInfo - Parsed column information
     * @param {Object} settings - Global settings
     */
    const renderTitle = useCallback((svg, config, columnInfo, settings) => {
        const { xAxisInfo, seriesInfo } = columnInfo;
        const title = config.title || generateTitle(
            config,
            seriesInfo.map(s => s.yAxisInfo),
            xAxisInfo
        );

        // Render Project Name (Primary Title)
        if (config.projectName) {
            svg.append("text")
                .attr("x", settings.graphDimensions.width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .attr("class", "project-name")
                .style("font-family", "sans-serif")
                .style("font-size", "28px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text(config.projectName);

            // Render Graph Title (Secondary Title)
            svg.append("text")
                .attr("x", settings.graphDimensions.width / 2)
                .attr("y", 55)
                .attr("text-anchor", "middle")
                .attr("class", "graph-title")
                .style("font-family", "sans-serif")
                .style("font-size", "20px")
                .style("font-weight", "normal")
                .style("fill", "#444")
                .text(title);
        } else {
            // Render Graph Title (Primary Title)
            svg.append("text")
                .attr("x", settings.graphDimensions.width / 2)
                .attr("y", 30)
                .attr("text-anchor", "middle")
                .attr("class", "graph-title")
                .style("font-family", "sans-serif")
                .style("font-size", "20px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text(title);
        }
    }, []);

    /**
     * Render axes with proper positioning
     * 
     * @param {d3.Selection} g - Main group element
     * @param {Object} scales - Created scales
     * @param {Object} columnInfo - Parsed column information
     * @param {Object} dimensions - Layout dimensions
     * @param {Object} config - Graph configuration
     * @param {Function} seriesColorScale - Color scale for series
     * @param {Object} settings - Global settings
     */
    const renderAxes = useCallback((g, scales, columnInfo, dimensions, config, seriesColorScale, settings, validData) => {
        const { xScale, yScale } = scales;
        const { xAxisInfo, seriesInfo, graphType } = columnInfo;
        const { width, height, margin } = dimensions;

        // Separate series by axis
        const { primary: primarySeries, secondary: secondarySeries } = groupSeriesByAxis(seriesInfo);
        const isDualAxis = secondarySeries.length > 0;

        // Generate axis labels - use custom labels if provided, otherwise auto-generate
        const xAxisLabel = config.xAxisLabel || xAxisInfo.columnName;

        let yAxisLabel;
        let axisColors = null;

        if (isDualAxis) {
            // Dual-axis mode: Apply intelligent coloring
            const primaryLabel = config.yAxisLabel || getAxisLabel(primarySeries, 'Primary Y-Axis');
            const secondaryLabel = config.yAxisLabel2 || getAxisLabel(secondarySeries, 'Secondary Y-Axis');

            yAxisLabel = {
                primary: primaryLabel,
                secondary: secondaryLabel
            };

            // Determine colors for each axis (colored if single series, black if multiple)
            const primaryColor = getAxisColor(primarySeries, seriesColorScale);
            const secondaryColor = getAxisColor(secondarySeries, seriesColorScale);

            axisColors = {
                primary: primaryColor,
                secondary: secondaryColor
            };
        } else {
            // Single axis mode: Always use black
            if (graphType === 'histogram') {
                yAxisLabel = config.yAxisLabel || 'Frequency';
            } else {
                yAxisLabel = config.yAxisLabel || getAxisLabel(primarySeries, 'Value');
            }

            // Single axis always uses black color
            axisColors = {
                primary: '#333'
            };
        }

        return drawAxes(
            g,
            xScale,
            yScale,
            height,
            width,
            margin,
            xAxisLabel,
            yAxisLabel,
            graphType,
            config,
            axisColors,
            seriesInfo,
            seriesColorScale,
            settings,
            validData, // Pass validData
            xAxisInfo  // Pass xAxisInfo
        );
    }, []);

    /**
     * Render logo image
     * 
     * @param {d3.Selection} svg - SVG element selection
     * @param {Image} logo - Logo image
     * @param {Object} dimensions - Layout dimensions
     */
    /**
     * Render data series using GraphService
     * 
     * @param {d3.Selection} g - Main group element
     * @param {Array} validData - Filtered valid data
     * @param {Object} scales - Created scales
     * @param {Object} columnInfo - Parsed column information
     * @param {Object} config - Graph configuration
     * @param {GraphService} graphService - Graph rendering service
     */
    const renderDataSeries = useCallback((g, validData, scales, columnInfo, config, graphService) => {
        const { xScale, yScale, colorScale, seriesColorScale } = scales;
        const { xAxisInfo, seriesInfo, colorInfo } = columnInfo;

        // Pass all required color parameters
        graphService.drawDataSeries(
            g,
            validData,
            xScale,
            yScale,
            xAxisInfo,
            seriesInfo,
            colorScale,
            colorInfo,
            config,
            seriesColorScale
        );
    }, []);

    /**
     * Render contours if configured
     * 
     * @param {d3.Selection} g - Main group element
     * @param {d3.Selection} svg - SVG element selection
     * @param {Array} validData - Filtered valid data
     * @param {Object} scales - Created scales
     * @param {Object} columnInfo - Parsed column information
     * @param {Object} config - Graph configuration
     * @param {Object} settings - Global settings
     * @param {GraphService} graphService - Graph rendering service
     */
    const renderContours = useCallback((g, svg, validData, scales, columnInfo, config, settings, graphService) => {
        if (!config.contouring || validData.length === 0 || columnInfo.graphType === 'histogram') {
            return;
        }

        const { xScale, yScale } = scales;
        const { contourInfo, seriesInfo } = columnInfo;

        if (!contourInfo || !seriesInfo.length) {
            return;
        }

        const targetIndex = config.contouringTarget !== undefined ? parseInt(config.contouringTarget) : 0;
        // Find the series info that matches the target index in the global config
        // Note: seriesInfo here is the parsed list. We need to map back to global index or assume order is preserved.
        // The parseColumnInformation function maps config.series to seriesInfo in order.
        const targetSeriesInfo = seriesInfo[targetIndex] || seriesInfo[0];

        return graphService.drawContours(
            g,
            svg,
            validData,
            contourInfo,
            columnInfo.xAxisInfo,
            targetSeriesInfo?.yAxisInfo,
            xScale,
            yScale,
            settings
        );
    }, []);

    /**
     * Render curve fits
     * 
     * @param {d3.Selection} g - Main group element
     * @param {Array} fits - Curve fitting results
     * @param {Object} scales - Created scales
     * @param {Object} dimensions - Layout dimensions
     * @param {Object} columnInfo - Parsed column information with seriesInfo
     * @param {GraphService} graphService - Graph rendering service
     */
    const renderCurveFits = useCallback((g, fits, scales, dimensions, columnInfo, graphService, axisInfo = {}) => {
        if (!fits || fits.length === 0) {
            return;
        }

        const { xScale, yScale } = scales;
        const { width } = dimensions;

        return graphService.drawCurveFits(g, fits, xScale, yScale, width, columnInfo.seriesInfo, axisInfo, dimensions);
    }, []);

    /**
     * Render legends (color and series)
     * 
     * @param {d3.Selection} svg - SVG element selection
     * @param {Array} validData - Filtered valid data
     * @param {Object} scales - Created scales
     * @param {Object} columnInfo - Parsed column information
     * @param {Object} config - Graph configuration
     * @param {Object} dimensions - Layout dimensions
     * @param {Object} settings - Global settings
     */
    const renderLegends = useCallback((
        svg,
        validData,
        scales,
        columnInfo,
        config,
        dimensions,
        settings,
        graphService,
        legendArtifacts = {}
    ) => {
        const { seriesColorScale, colorScale } = scales;
        const { seriesInfo, graphType, colorInfo } = columnInfo;
        const { margin = { top: 0, right: 0, bottom: 0, left: 0 } } = dimensions;
        const {
            contour = null,
            curve = null,
            axisInfo = {}
        } = legendArtifacts;

        if (colorScale && colorInfo?.columnName) {
            const colorValues = validData
                .map(d => d[colorInfo.columnName])
                .filter(v => v !== undefined && v !== null);

            if (colorValues.length > 0) {
                drawColorLegend(
                    svg,
                    colorScale,
                    colorValues,
                    colorInfo,
                    margin,
                    settings.graphDimensions,
                    config.colorScheme || settings.colorScheme
                );
            }
        }

        if (graphType !== 'histogram' && seriesInfo.length > 1 && seriesColorScale) {
            // Calculate legend offset based on dual axis presence
            const hasSecondaryAxis = config.series && config.series.some(s => s.axisAssignment === 'secondary');
            const legendOffset = hasSecondaryAxis ? 140 : 60; // Push legend further right if dual axis

            drawSeriesLegend(
                svg,
                seriesInfo,
                seriesColorScale,
                settings.graphDimensions,
                margin,
                legendOffset
            );
        }

        if (contour && contour.thresholds?.length) {
            drawContourLegend(
                svg,
                contour.contourInfo,
                contour.thresholds,
                contour.colorScale,
                settings.graphDimensions
            );
        }

        if (curve && Array.isArray(curve.legendItems) && curve.legendItems.length > 0) {
            const fallbackWidth = (dimensions.width || 0) + (margin.left + margin.right);
            graphService?.renderCurveFitLegend?.(
                svg,
                curve.legendItems,
                axisInfo,
                dimensions,
                fallbackWidth
            );
        }
    }, []);

    /**
     * Main graph generation function
     * 
     * @param {React.RefObject} svgRef - Reference to SVG element
     * @param {Function} onSuccess - Success callback
     * @param {Function} onError - Error callback
     * @returns {boolean} Success status
     */
    const generateGraph = useCallback((svgRef, onSuccess, onError, overrides = {}) => {
        try {
            let targetGraphConfig = overrides.graphConfig || graphConfig;
            const targetCsvData = overrides.csvData || csvData;
            const targetGlobalSettings = overrides.globalSettings || globalSettings;
            const targetColorSchemes = overrides.colorSchemes || colorSchemes;
            const targetLogoImage = overrides.hasOwnProperty('logoImage') ? overrides.logoImage : logoImage;
            const targetLogoReady = overrides.hasOwnProperty('logoReady') ? overrides.logoReady : logoReady;
            const targetCurveFits = overrides.curveFits ?? curveFits;
            const targetIsBatchMode = overrides.hasOwnProperty('isBatchMode') ? overrides.isBatchMode : isBatchMode;

            const graphType = (targetGraphConfig?.graphType || 'scatter').toLowerCase();

            // Validate required data
            if (!targetGraphConfig.xAxis || targetCsvData.length === 0) {
                console.warn('Missing required data for graph generation');
                if (onError) onError(new Error('Missing required data'));
                return false;
            }

            if (graphType !== 'histogram' && !targetGraphConfig.series?.some(s => s.yAxis)) {
                console.warn('No series configured for non-histogram graph');
                if (onError) onError(new Error('No series configured'));
                return false;
            }

            // Validate logo only for interactive mode
            if (!targetIsBatchMode && !targetLogoReady) {
                console.warn('Logo not ready yet, delaying graph generation');
                if (onError) onError(new Error('Logo not ready'));
                return false;
            }

            // Initialize SVG
            const svg = d3.select(svgRef.current);
            svg.selectAll("*").remove();

            // Set initial dimensions from global settings
            svg.attr('width', targetGlobalSettings.graphDimensions.width);
            svg.attr('height', targetGlobalSettings.graphDimensions.height);

            // Handle X-Axis Joining
            if (targetGlobalSettings.joinXAxis && targetGraphConfig.xAxis2) {
                // Determine unified column name
                const unifiedColName = '__unified_x__';
                const x1Info = parseColumnId(targetGraphConfig.xAxis);
                const x2Info = parseColumnId(targetGraphConfig.xAxis2);

                // Create a working copy of config to point to unified column
                // We clone it to avoid mutating original config
                targetGraphConfig = { ...targetGraphConfig, xAxis: unifiedColName };

                // Preserve label if missing, to avoid showing internal variable name
                if (!targetGraphConfig.xAxisLabel) {
                    targetGraphConfig.xAxisLabel = x1Info.columnName;
                }

                // Populate unified column in data (safe to mutate row objects as they are essentially data records)
                // We iterate over the targetCsvData and ensure the unified column exists
                targetCsvData.forEach(row => {
                    // Start with primary X
                    let val = row[x1Info.columnName];
                    // If invalid (undefined/null/empty), try secondary X
                    if (val === undefined || val === null || val === '') {
                        val = row[x2Info.columnName];
                    }
                    row[unifiedColName] = val;
                });

                debugLog('[useGraphRenderer] Joined X-Axes:', { x1: x1Info.columnName, x2: x2Info.columnName });
            }

            // Parse column information
            const columnInfo = parseColumnInformation(targetGraphConfig);
            if (columnInfo.graphType !== 'histogram' && columnInfo.seriesInfo.length === 0) {
                console.warn('No valid series configured');
                if (onError) onError(new Error('No valid series'));
                return false;
            }

            // Calculate dimensions
            const dimensions = calculateDimensions(targetGlobalSettings, columnInfo, targetGraphConfig);

            // Filter valid data
            let validData = FileService.filterValidData(
                targetCsvData,
                columnInfo.xAxisInfo,
                columnInfo.seriesInfo.map(s => s.yAxisInfo)
            );

            if (validData.length === 0) {
                console.warn('No valid data points found');
                if (onError) onError(new Error('No valid data points'));
                return false;
            }

            // Create scales
            const scales = createScales(validData, columnInfo, dimensions, targetGraphConfig, targetGlobalSettings);

            // Create main group
            const g = svg
                .append("g")
                .attr("transform", `translate(${dimensions.margin.left},${dimensions.margin.top})`);

            // Initialize graph service
            const graphService = new GraphService(targetColorSchemes);

            // Render all components
            renderTitle(svg, targetGraphConfig, columnInfo, targetGlobalSettings);
            // Draw axes and capture axis layout info for downstream positioning
            const axisInfo = renderAxes(g, scales, columnInfo, dimensions, targetGraphConfig, scales.seriesColorScale, targetGlobalSettings, validData) || {};
            renderLogo(svg, targetLogoImage, dimensions);
            renderDataSeries(g, validData, scales, columnInfo, targetGraphConfig, graphService);
            const contourLegend = renderContours(g, svg, validData, scales, columnInfo, targetGraphConfig, targetGlobalSettings, graphService) || null;
            const curveLegend = renderCurveFits(g, targetCurveFits, scales, dimensions, columnInfo, graphService, axisInfo) || { legendItems: [] };
            renderLegends(
                svg,
                validData,
                scales,
                columnInfo,
                targetGraphConfig,
                dimensions,
                targetGlobalSettings,
                graphService,
                {
                    contour: contourLegend,
                    curve: curveLegend,
                    axisInfo
                }
            );

            // -------------------------------------------------------------------------
            // Interaction Layer: Data Table on Hover
            if (targetGlobalSettings.showDataTable || targetGlobalSettings.showStaticTable) {
                const overlay = g.append("rect")
                    .attr("class", "overlay")
                    .attr("width", dimensions.width)
                    .attr("height", dimensions.height)
                    .style("fill", "none")
                    .style("pointer-events", "all");

                // Pre-sort data for efficient lookup
                const xCol = columnInfo.xAxisInfo.columnName;
                const sortedData = [...validData].sort((a, b) => +a[xCol] - +b[xCol]);
                const bisectDate = d3.bisector(d => +d[xCol]).left;

                // 1. Static Table Logic (Persistent)
                if (targetGlobalSettings.showStaticTable) {
                    const selectedX = targetGlobalSettings.selectedXValue;

                    if (selectedX !== null && selectedX !== undefined) {
                        const i = bisectDate(sortedData, selectedX, 1);

                        const hasSecondaryAxis = targetGraphConfig.series && targetGraphConfig.series.some(s => s.axisAssignment === 'secondary');
                        const legendXOffset = hasSecondaryAxis ? 140 : 60;
                        const legendX = dimensions.width - dimensions.margin.right + legendXOffset;
                        const legendHeight = columnInfo.seriesInfo.length * 25;
                        const tableY = dimensions.margin.top + legendHeight + 40;

                        const rowData = [];
                        // Header
                        rowData.push({
                            label: columnInfo.xAxisInfo.columnName,
                            value: selectedX,
                            color: '#333',
                            isHeader: true
                        });

                        columnInfo.seriesInfo.forEach(series => {
                            const yCol = series.yAxisInfo.columnName;
                            let foundVal = null;

                            let scanIdx = Math.min(i, sortedData.length - 1);
                            while (scanIdx >= 0 && +sortedData[scanIdx][xCol] > selectedX) {
                                scanIdx--;
                            }

                            for (let k = scanIdx; k >= 0; k--) {
                                const d = sortedData[k];
                                if (d[yCol] !== undefined && d[yCol] !== null && !isNaN(+d[yCol])) {
                                    foundVal = d[yCol];
                                    break;
                                }
                            }

                            const seriesColor = ScaleFactory.resolveColor(series.color) ||
                                (scales.seriesColorScale ? scales.seriesColorScale(yCol) : '#333');

                            rowData.push({
                                label: series.titleName || yCol,
                                value: foundVal !== null ? foundVal : "N/A",
                                color: seriesColor
                            });
                        });

                        // Draw Static Table
                        const staticTableGroup = svg.append("g")
                            .attr("class", "static-table-group")
                            .attr("transform", `translate(${legendX}, ${tableY})`);

                        const bg = staticTableGroup.append("rect")
                            .attr("rx", 4)
                            .attr("ry", 4)
                            .style("fill", "rgba(255, 255, 255, 0.95)")
                            .style("stroke", "#999")
                            .style("stroke-width", "1px");

                        let maxWidth = 0;
                        let currentY = 10;

                        staticTableGroup.append("text")
                            .attr("x", 10)
                            .attr("y", 0)
                            .style("font-family", "sans-serif")
                            .style("font-size", "11px")
                            .style("font-weight", "bold")
                            .style("fill", "#666")
                            .text("Selected Values:");

                        const titleWidth = staticTableGroup.select("text").node().getBBox().width;
                        maxWidth = Math.max(maxWidth, titleWidth);
                        currentY += 15;

                        rowData.forEach((row, idx) => {
                            const textRow = staticTableGroup.append("g")
                                .attr("transform", `translate(10, ${currentY + 12})`);

                            const labelText = textRow.append("text")
                                .text(`${row.label}:`)
                                .style("font-family", "sans-serif")
                                .style("font-size", "11px")
                                .style("font-weight", row.isHeader ? "bold" : "normal")
                                .style("fill", row.color || "#333");

                            const valueText = textRow.append("text")
                                .text(typeof row.value === 'number' ? row.value.toFixed(2) : row.value)
                                .style("font-family", "sans-serif")
                                .style("font-size", "11px")
                                .style("font-weight", "bold")
                                .style("fill", row.color || "#333");

                            const dimsLabel = labelText.node().getBBox();
                            const dimsValue = valueText.node().getBBox();
                            valueText.attr("x", dimsLabel.width + 5);

                            maxWidth = Math.max(maxWidth, dimsLabel.width + 5 + dimsValue.width);
                            currentY += 18;
                        });

                        bg.attr("width", maxWidth + 20)
                            .attr("height", currentY + 5);

                        // Draw Vertical Marker
                        g.append("line")
                            .attr("x1", scales.xScale(selectedX))
                            .attr("x2", scales.xScale(selectedX))
                            .attr("y1", 0)
                            .attr("y2", dimensions.height)
                            .style("stroke", "#666")
                            .style("stroke-width", "1px")
                            .style("stroke-dasharray", "4 4")
                            .style("pointer-events", "none");
                    }
                }

                // Table Group (Hover)
                const tableGroup = svg.append("g")
                    .attr("class", "hover-table-group")
                    .style("display", "none")
                    .style("pointer-events", "none");

                // Calculate Table Position (Underneath Legend)
                const hasSecondaryAxis = targetGraphConfig.series && targetGraphConfig.series.some(s => s.axisAssignment === 'secondary');
                const legendXOffset = hasSecondaryAxis ? 140 : 60;
                const legendX = dimensions.width - dimensions.margin.right + legendXOffset;
                const legendHeight = columnInfo.seriesInfo.length * 25;
                const tableY = dimensions.margin.top + legendHeight + 20; // 20px padding below legend

                overlay.on("mousemove", (event) => {
                    if (!targetGlobalSettings.showDataTable) return;
                    // Get mouse X
                    const [mouseX] = d3.pointer(event);
                    const x0 = scales.xScale.invert(mouseX);

                    // Find index in sorted data
                    const i = bisectDate(sortedData, x0, 1);
                    // We want the point at or before x0.
                    // bisectLeft gives insertion point.
                    // If immediate match, fine. If not, filtered logic handles "prev value".

                    // Logic: For EACH series, find the last valid value <= x0
                    // scan backwards from i

                    const rowData = [];
                    // Add X Value Header
                    rowData.push({
                        label: columnInfo.xAxisInfo.columnName,
                        value: x0, // Show the exact cursor X or the snapped X? "at a given x-value"
                        // "For series that don't have a x-value... use last x-value"
                        // Implies we show the values for that snapped point for each series.
                        // But the X itself? Maybe just the cursor X.
                        color: '#333',
                        isHeader: true
                    });

                    columnInfo.seriesInfo.forEach(series => {
                        const yCol = series.yAxisInfo.columnName;
                        let foundVal = null;

                        // Look backwards from i-1 down to 0
                        for (let k = i - 1; k >= 0; k--) {
                            const d = sortedData[k];
                            if (d[yCol] !== undefined && d[yCol] !== null && !isNaN(+d[yCol])) {
                                foundVal = d[yCol];
                                break;
                            }
                        }

                        // Resolve color matching the legend logic
                        const seriesColor = ScaleFactory.resolveColor(series.color) ||
                            (scales.seriesColorScale ? scales.seriesColorScale(yCol) : '#333');

                        if (foundVal !== null) {
                            rowData.push({
                                label: series.titleName || yCol,
                                value: foundVal,
                                color: seriesColor
                            });
                        } else {
                            rowData.push({
                                label: series.titleName || yCol,
                                value: "N/A",
                                color: seriesColor
                            });
                        }
                    });

                    // Update Table UI
                    tableGroup.style("display", null);
                    tableGroup.attr("transform", `translate(${legendX}, ${tableY})`);

                    // Clear previous
                    tableGroup.selectAll("*").remove();

                    // Background (styled later)
                    const bg = tableGroup.append("rect")
                        .attr("rx", 4)
                        .attr("ry", 4)
                        .style("fill", "rgba(255, 255, 255, 0.9)")
                        .style("stroke", "#ccc")
                        .style("stroke-width", "1px");

                    let maxWidth = 0;
                    let currentY = 10;

                    // Render Rows
                    rowData.forEach((row, idx) => {
                        const textRow = tableGroup.append("g")
                            .attr("transform", `translate(10, ${currentY + 12})`);

                        const labelText = textRow.append("text")
                            .text(`${row.label}:`)
                            .style("font-family", "sans-serif")
                            .style("font-size", "11px")
                            .style("font-weight", row.isHeader ? "bold" : "normal")
                            .style("fill", row.color || "#333");

                        const valueText = textRow.append("text")
                            .text(typeof row.value === 'number' ? row.value.toFixed(2) : row.value)
                            .style("font-family", "sans-serif")
                            .style("font-size", "11px")
                            .style("font-weight", "bold")
                            .style("fill", row.color || "#333");

                        // Measure
                        const dimsLabel = labelText.node().getBBox();
                        const dimsValue = valueText.node().getBBox();

                        // Temporarily position (will adjust for alignment if needed, but simple flow is fine)
                        // Actually, let's align: Label Left, Value Right
                        // We need two passes or fixed width. 
                        // Let's just put value after label with space.

                        valueText.attr("x", dimsLabel.width + 5);

                        maxWidth = Math.max(maxWidth, dimsLabel.width + 5 + dimsValue.width);
                        currentY += 18;
                    });

                    bg.attr("width", maxWidth + 20)
                        .attr("height", currentY + 5);

                })
                    .on("mouseout", () => {
                        tableGroup.style("display", "none");
                    })
                    .on("click", (event) => {
                        // Click Interaction for Static Table
                        if (targetGlobalSettings.showStaticTable && !targetIsBatchMode) {
                            const [mouseX] = d3.pointer(event);
                            const x0 = scales.xScale.invert(mouseX);

                            if (onXValueSelect) {
                                onXValueSelect(x0);
                            }
                        }
                    });
            }
            // -------------------------------------------------------------------------

            // Skip expensive CanvasSizer in batch mode - use fixed dimensions
            if (targetIsBatchMode) {
                if (onSuccess) onSuccess({ success: true, margin: dimensions.margin });
                return true;
            }

            let finalDimensions = { width: dimensions.width, height: dimensions.height };

            // Dynamic canvas sizing (ensure all content fits) - only for interactive mode
            try {
                // Initialize sizer with minimal margins since we're measuring the entire SVG content
                const canvasSizer = new CanvasSizer(svgRef.current, {
                    margins: { top: 10, right: 10, bottom: 10, left: 10 },
                    minWidth: 400,
                    minHeight: 300,
                    maxWidth: 8192,
                    maxHeight: 8192,
                    expandMode: 'expand',
                    dpiMultiplier: 1, // Default, can be adjusted for export
                    debounceMs: 0
                });

                // Always use DOM measurement of the ROOT SVG to capture legends, titles, and axes
                // This ensures "dynamic components" outside the main plot area are included
                canvasSizer.updateFromDOMSync(svgRef.current);
                const fitResult = canvasSizer.ensureFit();
                finalDimensions = { width: fitResult.width, height: fitResult.height };

                // Clean up sizer (we don't need continuous monitoring)
                canvasSizer.teardown();
            } catch (sizingError) {
                debugWarn('[useGraphRenderer] Canvas sizing failed, using default dimensions:', sizingError);
            }

            if (onSuccess) onSuccess({ success: true, margin: dimensions.margin, finalDimensions });
            return true;
        } catch (error) {
            debugWarn('Failed to generate graph:', error);
            if (onError) onError(error);
            return false;
        }
    }, [
        csvData,
        graphConfig,
        curveFits,
        globalSettings,
        logoImage,
        logoReady,
        getAxisIntercepts,
        colorSchemes,
        parseColumnInformation,
        calculateDimensions,
        createScales,
        renderTitle,
        renderAxes,
        renderLogo,
        renderDataSeries,
        renderContours,
        renderCurveFits,
        renderLegends,
        renderCurveFits,
        renderLegends,
        isBatchMode,
        onXValueSelect
    ]);

    return { generateGraph };
}
