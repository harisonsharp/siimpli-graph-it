import React from 'react';

/**
 * @fileoverview Display component for showing coordinate system information and axis scaling parameters.
 * Renders parsed axis data including zero points, pixels per unit, and coordinate conversion information for debugging.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @performance Optimized with React.memo to prevent unnecessary re-renders
 * @updated 2025-01-01 Phase 9: Added React.memo optimization
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library for component creation
 *
 * @param {Object} props - Component props
 * @param {Object|null} props.parsedData - Coordinate system data extracted from filename
 * @param {Object} props.parsedData.x - X-axis scaling information (zero, ppu, name)
 * @param {Object} props.parsedData.y - Y-axis scaling information (zero, ppu, name)
 * @param {Object} [props.parsedData.y2] - Optional second Y-axis information
 * @param {Object} props.parsedData.dimensions - Image dimensions for coordinate bounds
 *
 * @exports default CoordinateSystemInfo
 *
 * @example
 * <CoordinateSystemInfo parsedData={axisData} />
 * <CoordinateSystemInfo parsedData={null} /> // Shows empty state
 *
 * @relatedFiles FileNameParsingService.js, CoordinateService.js - Displays data from filename parsing and coordinate conversion
 */

const CoordinateSystemInfo = React.memo(({ parsedData }) => {
    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Coordinate System Info</h3>
            </div>
            <div className="card-body">
                <div className="filename-parsed-info">
                    <div className="filename-parsed-item">
                        <span className="filename-parsed-label">X-Axis:</span>
                        <span className="filename-parsed-value">
                            {parsedData.x.name} (Zero: {parsedData.x.zero}px, PPU: {parsedData.x.ppu})
                        </span>
                    </div>
                    <div className="filename-parsed-item">
                        <span className="filename-parsed-label">Y-Axis:</span>
                        <span className="filename-parsed-value">
                            {parsedData.y.name} (Zero: {parsedData.y.zero}px, PPU: {parsedData.y.ppu})
                        </span>
                    </div>
                    {parsedData.y2 && (
                        <div className="filename-parsed-item">
                            <span className="filename-parsed-label">Y2-Axis:</span>
                            <span className="filename-parsed-value">
                                {parsedData.y2.name} (Zero: {parsedData.y2.zero}px, PPU: {parsedData.y2.ppu})
                            </span>
                        </div>
                    )}
                    <div className="filename-parsed-item">
                        <span className="filename-parsed-label">Intercepts:</span>
                        <span className="filename-parsed-value">
                            ({parsedData.intercepts.x}, {parsedData.intercepts.y})
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

CoordinateSystemInfo.displayName = 'CoordinateSystemInfo';

export default CoordinateSystemInfo;
