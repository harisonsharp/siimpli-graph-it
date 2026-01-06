import React from 'react';
/**
 * @fileoverview Development utility component for displaying debugging information and parsed data structures.
 * Conditionally renders formatted JSON output of parsed filename data for development and troubleshooting purposes.
 * Optimized with React.memo to prevent unnecessary re-renders.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @updated 0.3.0 - Added React.memo optimization
 *
 * @component React Functional Component (Memoized)
 * @type {React.FC}
 *
 * @requires react - Core React library for component creation
 *
 * @param {Object} props - Component props
 * @param {Object|null} props.debugInfo - Debug data structure to display
 * @param {Object} [props.debugInfo.parsed] - Parsed filename information
 * @param {boolean} props.showDebug - Flag to control debug panel visibility
 *
 * @exports default DebugInfoCard
 *
 * @example
 * <DebugInfoCard debugInfo={parseResult} showDebug={isDev} />
 * <DebugInfoCard debugInfo={null} showDebug={false} /> // Returns null
 *
 * @performance Memoized to prevent re-renders when debug info hasn't changed
 * @relatedFiles FileNameDecoder.jsx, FileNameParsingService.js - Displays debug output from filename parsing
 */

const DebugInfoCard = React.memo(({ debugInfo, showDebug }) => {
    if (!showDebug || !debugInfo) return null;

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Debug Information</h3>
            </div>
            <div className="card-body">
                <div className="filename-parsed-info">
                    <h4 className="filename-parsed-title">Parsed Data:</h4>
                    <pre className="text-sm bg-gray-100 p-3 rounded overflow-auto">
                        {JSON.stringify(debugInfo.parsed, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
});

DebugInfoCard.displayName = 'DebugInfoCard';

export default DebugInfoCard;
