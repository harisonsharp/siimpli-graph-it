import React from 'react';
import { FileText } from 'lucide-react';
/**
 * @fileoverview Application header component providing title and description for the filename decoder tool.
 * Displays branding information and explains the purpose of the coordinate system extraction functionality.
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
 * @requires lucide-react - Icon components for visual branding (FileText)
 *
 * @exports default DecoderHeader
 *
 * @example
 * <DecoderHeader />
 *
 * @relatedFiles FileNameDecoder.jsx - Header component for main decoder application
 */

const DecoderHeader = React.memo(() => {
    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">
                    <FileText className="inline-block w-6 h-6 mr-2" />
                    Graph Filename Decoder
                </h2>
            </div>
            <div className="card-body">
                <p className="text-muted">
                    Decode structured graph filenames and plot specific coordinate points on the graph.
                    Upload a PNG file with a structured filename to extract coordinate system information.
                </p>
            </div>
        </div>
    );
});

DecoderHeader.displayName = 'DecoderHeader';

export default DecoderHeader;
