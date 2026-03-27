import React, { useState } from 'react';
import { ImageExportService } from '@harisonsharp/graph-it-core';
import { useImageLoader } from '../hooks/useImageLoader.js';
import { useErrorHandler } from '../hooks/useErrorHandler.js';
import { usePlotting } from '../hooks/usePlotting.js';
import DecoderHeader from './DecoderHeader.jsx';
import FileUploadCard from './FileUploadCard.jsx';
import DebugInfoCard from './DebugInfoCard.jsx';
import GraphImageDisplay from './GraphImageDisplay.jsx';
import CoordinateSystemInfo from './CoordinateSystemInfo.jsx';
import PlotControlsCard from './PlotControlsCard.jsx';
import EmptyStateCard from './EmptyStateCard.jsx';
import ErrorDisplay from './ErrorDisplay.jsx';

/**
 * @fileoverview Main decoder component for extracting coordinate system information from structured graph filenames.
 * Orchestrates file upload, filename parsing, coordinate plotting, and image annotation with error handling.
 *
 * @author Harison Sharp
 * @since 0.2.0
 *
 * @component React Functional Component - Main Application Component
 * @type {React.FC}
 *
 * @requires react - Core React library with hooks
 * @requires ./ImageExportService.js - Service for exporting annotated graphs
 * @requires ./useImageLoader.js - Custom hook for image loading and parsing
 * @requires ./useErrorHandler.js - Custom hook for error state management
 * @requires ./usePlotting.js - Custom hook for coordinate plotting functionality
 * @requires Multiple UI components - DecoderHeader, FileUploadCard, CoordinateSystemInfo, etc.
 *
 * @state {boolean} showDebug - Controls visibility of debug information panel
 *
 * @exports default FilenameDecoder
 *
 * @example
 * <FilenameDecoder />
 *
 * @relatedFiles FileNameParsingService.js, CoordinateService.js, All UI components - Central orchestration component
 */

const FilenameDecoder = () => {
    const [showDebug, setShowDebug] = useState(false);
    const { error, showError, clearError } = useErrorHandler();

    const {
        selectedFile,
        parsedData,
        imageUrl,
        imageDimensions,
        isLoading,
        debugInfo,
        selectPNGFile,
        updateImageDimensions
    } = useImageLoader(showError);

    const {
        userInput,
        setUserInput,
        plotted,
        plotPoint,
        clearPlot,
        isValidInput
    } = usePlotting(parsedData, imageDimensions, showError);

    const handleExport = async () => {
        if (!imageUrl || !graphImageDisplay.svgRef.current) {
            showError('No image or plot data available for export');
            return;
        }

        try {
            const filePath = await ImageExportService.exportAnnotatedGraph(
                imageUrl,
                graphImageDisplay.svgRef.current,
                imageDimensions,
                selectedFile
            );

            if (filePath) {
                showError('Annotated graph exported successfully!');
            }
        } catch (error) {
            console.error('Error exporting annotated graph:', error);
            showError(`Failed to export annotated graph: ${error.message}`);
        }
    };

    const graphImageDisplay = GraphImageDisplay({
        imageUrl,
        imageDimensions,
        onImageLoad: updateImageDimensions
    });

    return (
        <div className="filename-decoder-container">
            <DecoderHeader />

            <FileUploadCard
                selectedFile={selectedFile}
                imageDimensions={imageDimensions}
                isLoading={isLoading}
                showDebug={showDebug}
                onSelectFile={selectPNGFile}
                onToggleDebug={() => setShowDebug(!showDebug)}
            />

            <DebugInfoCard debugInfo={debugInfo} showDebug={showDebug} />

            {parsedData && imageUrl ? (
                <div className="filename-display-section">
                    {graphImageDisplay.component}

                    <div className="space-y-6">
                        <CoordinateSystemInfo parsedData={parsedData} />

                        <PlotControlsCard
                            parsedData={parsedData}
                            userInput={userInput}
                            setUserInput={setUserInput}
                            plotted={plotted}
                            isValidInput={isValidInput}
                            isLoading={isLoading}
                            onPlotPoint={() => plotPoint(graphImageDisplay.svgRef)}
                            onClearPlot={() => clearPlot(graphImageDisplay.svgRef)}
                            onExport={handleExport}
                        />
                    </div>
                </div>
            ) : (
                <EmptyStateCard selectedFile={selectedFile} />
            )}

            <ErrorDisplay error={error} onClearError={clearError} />
        </div>
    );
};

export default FilenameDecoder;
