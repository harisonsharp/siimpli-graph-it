import { useState, useCallback } from 'react';
import { FileService, debugLog, debugWarn } from '@harisonsharp/graph-it-core';
/**
 * @fileoverview React hook for managing CSV file uploads and data state coordination.
 * Handles multi-file data management, column extraction, and graph configuration
 * updates for the scientific data visualization application.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @module useFileManager
 *
 * @description Custom hook managing the complete file upload and data management lifecycle.
 * Coordinates CSV file loading, column metadata extraction, and maintains synchronized
 * state between file data and graph configuration settings.
 *
 * @requires react - useState and useCallback hooks for state management
 * @requires FileService.js - Service class for file loading and processing operations
 *
 * @param {Object} graphConfig - Current graph configuration state
 * @param {Function} updateGraphConfig - Callback to update graph configuration settings
 * @returns {Object} File management state and handler functions
 *
 * @example
 * const { csvFiles, handleFileUpload } = useFileManager(graphConfig, updateConfig);
 * await handleFileUpload(selectedFiles);
 *
 * @relatedFiles useFileProcessing.js, FileService.js, useGraphGeneration.js
 */

export const useFileManager = (graphConfig, updateGraphConfig) => {
    const [csvFiles, setCsvFiles] = useState([]);
    const [csvData, setCsvData] = useState([]);
    const [columns, setColumns] = useState([]);

    const removeFile = useCallback((fileName) => {
        setCsvFiles(prev => prev.filter(file => file.name !== fileName));
        setCsvData(prev => prev.filter(data => data._sourceFile !== fileName));
        setColumns(prev => prev.filter(col => col.file !== fileName));
    }, []);

    const handleFileUpload = async (files) => {
        const fileArray = Array.from(files);

        // Remove existing files with same names
        // fileArray.forEach(file => removeFile(file.name));

        const { newFiles, newData, allColumns } = await FileService.loadFiles(fileArray);

        setCsvFiles(prev => [...prev, ...newFiles]);
        setCsvData(prev => [...prev, ...newData]);
        setColumns(prev => [...prev, ...allColumns]);
    };

    return {
        csvFiles,
        csvData,
        columns,
        removeFile,
        handleFileUpload
    };
};
