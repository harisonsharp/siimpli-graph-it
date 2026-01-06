import React from 'react';
import { AlertCircle, X } from 'lucide-react';
/**
 * @fileoverview Error message display component with dismiss functionality and visual error indicators.
 * Renders error notifications with appropriate styling and user interaction for error acknowledgment.
 * Optimized with React.memo to prevent unnecessary re-renders when props don't change.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @updated 0.3.0 - Added React.memo optimization
 *
 * @component React Functional Component (Memoized)
 * @type {React.FC}
 *
 * @requires react - Core React library for component creation
 * @requires lucide-react - Icon components for error display (AlertCircle, X)
 *
 * @param {Object} props - Component props
 * @param {string|null} props.error - Error message to display
 * @param {Function} props.onClearError - Callback function to dismiss error
 *
 * @exports default ErrorDisplay
 *
 * @example
 * <ErrorDisplay error="File not found" onClearError={handleClear} />
 * <ErrorDisplay error={null} onClearError={handleClear} /> // Returns null
 *
 * @performance Memoized to prevent re-renders when error message hasn't changed
 * @relatedFiles ErrorContext.jsx - UI component for displaying errors from error context
 */

const ErrorDisplay = React.memo(({ error, onClearError }) => {
    if (!error) return null;

    return (
        <div className="error-container">
            <div className="error-message">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={onClearError} className="error-close">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

ErrorDisplay.displayName = 'ErrorDisplay';

export default ErrorDisplay;
