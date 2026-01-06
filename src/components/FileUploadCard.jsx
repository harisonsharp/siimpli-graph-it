import React from 'react';
import { Upload, FileText, Eye } from 'lucide-react';
/**
 * @fileoverview File upload interface component with drag-and-drop support and file selection controls.
 * Provides user interface for selecting PNG files and toggling debug mode with visual loading indicators.
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
 * @requires lucide-react - Icon components for UI elements (Upload, FileText, Eye)
 *
 * @param {Object} props - Component props
 * @param {string|null} props.selectedFile - Name of currently selected file
 * @param {Object|null} props.imageDimensions - Dimensions of loaded image
 * @param {boolean} props.isLoading - Loading state indicator
 * @param {boolean} props.showDebug - Current debug mode state
 * @param {Function} props.onSelectFile - Callback for file selection
 * @param {Function} props.onToggleDebug - Callback for debug mode toggle
 *
 * @exports default FileUploadCard
 *
 * @example
 * <FileUploadCard selectedFile="graph.png" onSelectFile={handleSelect} />
 *
 * @relatedFiles FileNameDecoder.jsx - Primary file upload interface for the decoder application
 */

const FileUploadCard = React.memo(({
                            selectedFile,
                            imageDimensions,
                            isLoading,
                            showDebug,
                            onSelectFile,
                            onToggleDebug
                        }) => {
    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Select Graph Image</h3>
            </div>
            <div className="card-body">
                <div className="filename-upload-section">
                    <button
                        onClick={onSelectFile}
                        disabled={isLoading}
                        className="btn btn-primary btn-lg w-full"
                    >
                        <Upload className="w-5 h-5" />
                        {isLoading ? 'Loading...' : 'Select PNG File'}
                    </button>

                    {selectedFile && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <div className="font-medium">
                                            {selectedFile.split(/[\/]/).pop()}
                                        </div>
                                        <div className="text-sm text-muted">
                                            Dimensions: {imageDimensions.width} × {imageDimensions.height}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onToggleDebug}
                                    className="btn btn-outline btn-sm"
                                >
                                    <Eye className="w-4 h-4" />
                                    {showDebug ? 'Hide' : 'Show'} Debug Info
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

FileUploadCard.displayName = 'FileUploadCard';

export default FileUploadCard;
