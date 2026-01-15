import { useState, useCallback } from 'react';
import { CoordinateService, debugLog, debugWarn } from '@siimpli/graph-it-core';
import { SvgPlottingService } from '@siimpli/graph-it-core';
/**
 * @fileoverview React hook for interactive coordinate plotting and point validation.
 * Manages user input for coordinate values, point plotting operations, and real-time
 * validation for the scientific graph analysis interface.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @module usePlotting
 *
 * @description Custom hook providing complete plotting functionality including coordinate input
 * management, pixel conversion, boundary validation, and SVG rendering coordination.
 * Integrates with coordinate services for accurate mathematical plotting operations.
 *
 * @requires react - useState and useCallback hooks for state management
 * @requires CoordinateService.js - Service for coordinate system conversions
 * @requires SvgPlottingService.js - Service for SVG element rendering and manipulation
 *
 * @param {Object} parsedData - Graph metadata including coordinate system information
 * @param {Object} imageDimensions - Image boundary dimensions for validation
 * @param {Function} showError - Error display callback function
 * @returns {Object} Plotting state and control functions
 *
 * @example
 * const { userInput, plotPoint, isValidInput } = usePlotting(data, dimensions, showError);
 *
 * @relatedFiles PlotControlsCard.jsx, SvgPlottingService.js, CoordinateService.js
 */

export const usePlotting = (parsedData, imageDimensions, showError) => {
    const [userInput, setUserInput] = useState({ x: '', y: '', y2: '' });
    const [plotted, setPlotted] = useState(false);

    const plotPoint = useCallback((svgRef) => {
        const pixels = CoordinateService.valuesToPixels(userInput, parsedData);
        if (!pixels || !svgRef.current) {
            showError('Invalid input values or missing graph data');
            return;
        }

        // Validate pixel coordinates are within image bounds
        if (!CoordinateService.validatePixelBounds(pixels, imageDimensions)) {
            showError('Calculated point is outside the image bounds. Please check your input values.');
            return;
        }

        SvgPlottingService.plotPoint(svgRef.current, pixels, userInput, parsedData);
        setPlotted(true);
    }, [userInput, parsedData, imageDimensions, showError]);

    const clearPlot = useCallback((svgRef) => {
        if (svgRef.current) {
            SvgPlottingService.clearSvg(svgRef.current);
        }
        setPlotted(false);
    }, []);

    const isValidInput = userInput.x && userInput.y &&
        !isNaN(parseFloat(userInput.x)) &&
        !isNaN(parseFloat(userInput.y));

    return {
        userInput,
        setUserInput,
        plotted,
        plotPoint,
        clearPlot,
        isValidInput
    };
};
