import { useCallback } from 'react';
import { readTextFile, readDir, writeFile } from '@tauri-apps/plugin-fs';
import { parseConfigFile, determineGraphType, resolveColumn, debugLog, debugWarn, parseCSV, useError } from '@siimpli/graph-it-core';
/**
 * @fileoverview React hook for processing CSV data files and configuration management.
 * Provides comprehensive file I/O operations including CSV parsing, configuration file handling,
 * and directory processing for batch data analysis workflows.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @module useFileProcessing
 *
 * @description Custom hook abstracting file processing operations for the Tauri-based desktop
 * application. Manages CSV data parsing, JSON configuration handling, and provides
 * error-safe file operations with automatic cleanup and validation.
 *
 * @requires react - useCallback hook for memoized function creation
 * @requires @tauri-apps/plugin-fs - Tauri filesystem plugin for file operations
 * @requires dataUtils.js - Data parsing and column resolution utilities
 * @requires ErrorContext.jsx - Application-wide error handling context
 *
 * @returns {Object} File processing methods and utilities
 *
 * @example
 * const { processFile, saveFile } = useFileProcessing();
 * const data = await processFile('/path/to/data.csv');
 *
 * @relatedFiles useFileManager.js, constants.js, useImageLoader.js
 */

export const useFileProcessing = () => {
    const { handleError } = useError();

    const processFile = useCallback(async (filePath) => {
        try {
            const csvContent = await readTextFile(filePath);
            const { headers, data } = parseCSV(csvContent);

            if (data.length === 0) {
                throw new Error('No data found in file');
            }

            return { headers, data };
        } catch (error) {
            handleError(error, `Failed to process file: ${filePath}`);
            return null;
        }
    }, [handleError]);

    const processConfigFile = useCallback(async (configPath) => {
        try {
            const configContent = await readTextFile(configPath);
            return parseConfigFile(configContent);
        } catch (error) {
            handleError(error, 'Failed to process configuration file');
            return null;
        }
    }, [handleError]);

    const processJsonConfig = useCallback(async (configPath) => {
        try {
            const content = await readTextFile(configPath);
            return JSON.parse(content);
        } catch (error) {
            handleError(error, 'Invalid JSON configuration file');
            return null;
        }
    }, [handleError]);

    const processDirectory = useCallback(async (inputFolder) => {
        try {
            const entries = await readDir(inputFolder);

            const csvFiles = entries.filter(entry =>
                entry.name && entry.name.toLowerCase().endsWith('.csv')
            );

            const configFile = entries.find(entry =>
                entry.name && (entry.name.toLowerCase().endsWith('.txt') ||
                    entry.name.toLowerCase().endsWith('.config'))
            );

            return { csvFiles, configFile };
        } catch (error) {
            handleError(error, 'Failed to read directory');
            return { csvFiles: [], configFile: null };
        }
    }, [handleError]);

    const saveFile = useCallback(async (filePath, data) => {
        try {
            const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            await writeFile(filePath, content);
            return true;
        } catch (error) {
            handleError(error, 'Failed to save file');
            return false;
        }
    }, [handleError]);

    const resolveConfig = useCallback((config, data) => {
        return {
            ...config,
            xAxis: resolveColumn(data, config.xAxis),
            yAxis: resolveColumn(data, config.yAxis),
            yAxis2: resolveColumn(data, config.yAxis2),
            colorGrading: resolveColumn(data, config.colorGrading),
            contouring: resolveColumn(data, config.contouring),
        };
    }, []);

    return {
        processFile,
        processConfigFile,
        processJsonConfig,
        processDirectory,
        saveFile,
        resolveConfig
    };
};
