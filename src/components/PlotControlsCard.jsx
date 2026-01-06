import React from 'react';
import { MapPin, X, Download } from 'lucide-react';
/**
 * @fileoverview React component providing user interface controls for coordinate plotting and data export.
 * Renders input fields, validation feedback, and action buttons for interactive graph point plotting
 * within the scientific data visualization workflow.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @performance Optimized with React.memo to prevent unnecessary re-renders
 * @updated 2025-01-01 Phase 9: Added React.memo optimization
 * @component PlotControlsCard
 *
 * @description UI component that enables users to input coordinate values, plot points on graphs,
 * and export visualization data. Includes real-time validation, loading states, and intuitive
 * controls for mathematical analysis and curve fitting operations.
 *
 * @requires react - React library for component functionality
 * @requires lucide-react - Icon library for UI visual elements
 *
 * @param {Object} parsedData - Parsed graph data containing coordinate system information
 * @param {string} userInput - Current user input values for x, y coordinates
 * @param {Function} setUserInput - State setter for updating coordinate input values
 * @param {boolean} plotted - Flag indicating if a point has been plotted
 * @param {boolean} isValidInput - Validation status of current user input
 * @param {boolean} isLoading - Loading state for asynchronous operations
 * @param {Function} onPlotPoint - Callback function to execute point plotting
 * @param {Function} onClearPlot - Callback function to clear plotted elements
 * @param {Function} onExport - Callback function for data export operations
 *
 * @returns {JSX.Element} Rendered plot controls interface component
 *
 * @example
 * <PlotControlsCard parsedData={data} userInput={input} onPlotPoint={handlePlot} />
 *
 * @relatedFiles usePlotting.js, SvgPlottingService.js, useImageLoader.js
 */

const PlotControlsCard = React.memo(({
                              parsedData,
                              userInput,
                              setUserInput,
                              plotted,
                              isValidInput,
                              isLoading,
                              onPlotPoint,
                              onClearPlot,
                              onExport
                          }) => {
    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Plot Coordinates</h3>
            </div>
            <div className="card-body">
                <div className="space-y-4">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">
                                {parsedData.x.name} Value
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="form-input"
                                placeholder="Enter X coordinate"
                                value={userInput.x}
                                onChange={(e) => setUserInput(prev => ({
                                    ...prev,
                                    x: e.target.value
                                }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                {parsedData.y.name} Value
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="form-input"
                                placeholder="Enter Y coordinate"
                                value={userInput.y}
                                onChange={(e) => setUserInput(prev => ({
                                    ...prev,
                                    y: e.target.value
                                }))}
                            />
                        </div>
                    </div>

                    {parsedData.y2 && (
                        <div className="form-group">
                            <label className="form-label">
                                {parsedData.y2.name} Value (Optional)
                            </label>
                            <input
                                type="number"
                                step="any"
                                className="form-input"
                                placeholder="Enter Y2 coordinate"
                                value={userInput.y2}
                                onChange={(e) => setUserInput(prev => ({
                                    ...prev,
                                    y2: e.target.value
                                }))}
                            />
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onPlotPoint}
                            disabled={!isValidInput || isLoading}
                            className="btn btn-primary flex-1"
                        >
                            <MapPin className="w-4 h-4" />
                            Plot Point
                        </button>

                        {plotted && (
                            <button
                                onClick={onClearPlot}
                                className="btn btn-outline"
                            >
                                <X className="w-4 h-4" />
                                Clear
                            </button>
                        )}
                    </div>

                    {plotted && (
                        <button
                            onClick={onExport}
                            disabled={isLoading}
                            className="btn btn-success w-full"
                        >
                            <Download className="w-4 h-4" />
                            {isLoading ? 'Exporting...' : 'Export Annotated Graph'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

PlotControlsCard.displayName = 'PlotControlsCard';

export default PlotControlsCard;
