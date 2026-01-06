import React from 'react';
import { FileText, AlertCircle } from 'lucide-react';
/**
 * @fileoverview Empty state UI component for guiding users when no file is selected or data unavailable.
 * Displays informational messages and icons to prompt user action when the application lacks input data.
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
 * @requires lucide-react - Icon components for visual feedback (FileText, AlertCircle)
 *
 * @param {Object} props - Component props
 * @param {string|null} props.selectedFile - Currently selected filename or null
 *
 * @exports default EmptyStateCard
 *
 * @example
 * <EmptyStateCard selectedFile={null} />
 * <EmptyStateCard selectedFile="graph.png" />
 *
 * @performance Memoized to prevent re-renders when selectedFile prop doesn't change
 * @relatedFiles FileNameDecoder.jsx - Used for empty state display in main decoder component
 */

const EmptyStateCard = React.memo(({ selectedFile }) => {
    if (!selectedFile) {
        return (
            <div className="card">
                <div className="card-body text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No File Selected</h3>
                    <p className="text-muted">
                        Please select a PNG file with structured filename to begin.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-body text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Unable to Parse File</h3>
                <p className="text-muted">
                    No graph information available. Please select a valid PNG file with proper naming convention.
                </p>
            </div>
        </div>
    );
});

EmptyStateCard.displayName = 'EmptyStateCard';

export default EmptyStateCard;
