import { useState, useRef, useEffect } from 'react';
import { ImageExportService, debugLog, debugWarn } from '@siimpli/graph-it-core';
import { FileNameParsingService } from '@siimpli/graph-it-core';
/**
 * @fileoverview React hook for loading and managing graph image files with filename parsing.
 * Handles PNG file selection, blob URL management, and coordinate system data extraction
 * from specially formatted filenames in the scientific visualization workflow.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @module useImageLoader
 *
 * @description Custom hook managing image file loading operations with automatic filename parsing
 * to extract coordinate system metadata. Provides memory-safe blob URL handling and
 * dimension tracking for graph overlay functionality.
 *
 * @requires react - React hooks for state and lifecycle management
 * @requires ImageExportService.js - Service for image file I/O operations
 * @requires FileNameParsingService.js - Utility for extracting metadata from filenames
 *
 * @param {Function} showError - Error display callback function
 * @returns {Object} Hook state and methods for image loading operations
 *
 * @example
 * const { selectPNGFile, parsedData, imageUrl } = useImageLoader(showError);
 * await selectPNGFile();
 *
 * @relatedFiles PlotControlsCard.jsx, useFileProcessing.js, usePlotting.js
 */

export const useImageLoader = (showError) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 800, height: 600 });
    const [isLoading, setIsLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState(null);
    const currentBlobUrl = useRef(null);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            if (currentBlobUrl.current) {
                URL.revokeObjectURL(currentBlobUrl.current);
            }
        };
    }, []);

    // Cleanup previous blob URL when imageUrl changes
    useEffect(() => {
        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    const selectPNGFile = async () => {
        try {
            setIsLoading(true);

            // Cleanup previous blob URL
            if (currentBlobUrl.current) {
                URL.revokeObjectURL(currentBlobUrl.current);
                currentBlobUrl.current = null;
            }

            const imageData = await ImageExportService.loadImageFile();
            if (!imageData) {
                setIsLoading(false);
                return;
            }

            const parsed = FileNameParsingService.parseGraphFilename(imageData.filePath);
            setDebugInfo({
                filename: imageData.filePath,
                parsed
            });

            if (!parsed) {
                showError('Unable to parse filename. Please select a valid graph file with proper naming convention.');
                imageData.cleanup();
                setIsLoading(false);
                return;
            }

            setSelectedFile(imageData.filePath);
            setParsedData(parsed);
            currentBlobUrl.current = imageData.fileUrl;
            setImageUrl(imageData.fileUrl);

        } catch (error) {
            console.error('Error reading file:', error);
            showError(`Failed to read the selected file: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const updateImageDimensions = (dimensions) => {
        setImageDimensions(dimensions);
        if (parsedData &&
            (parsedData.dimensions.width !== dimensions.width ||
                parsedData.dimensions.height !== dimensions.height)) {
            setParsedData(prev => ({
                ...prev,
                dimensions
            }));
        }
    };

    return {
        selectedFile,
        parsedData,
        imageUrl,
        imageDimensions,
        isLoading,
        debugInfo,
        selectPNGFile,
        updateImageDimensions
    };
};
