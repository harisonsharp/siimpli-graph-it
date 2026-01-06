import React, { useState, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Play, CheckCircle, AlertCircle, Settings2 } from 'lucide-react';
import { useFileProcessing } from '../hooks/useFileProcessing.js';
import { useBatchGraphRenderer } from '../hooks/useBatchGraphRenderer.js';
import { useError } from '../contexts/ErrorContext.jsx';
import { useConfig } from '../contexts/ConfigContext.jsx';
import { BatchProcessingService } from '@siimpli/graph-it-core';
/**
 * @fileoverview Simplified batch processing component for automated graph generation.
 * UI-focused component that delegates business logic to BatchProcessingService.
 * Manages user interactions, file selection, and displays processing progress.
 *
 * @author Harison Sharp
 * @since 0.3.0 (Refactored from 0.2.0)
 *
 * @component React Functional Component - Batch Processing Interface
 * @type {React.FC}
 *
 * @requires react - Core React library with hooks
 * @requires @tauri-apps/plugin-dialog - File system integration
 * @requires lucide-react - UI icons
 * @requires ./core/services/BatchProcessingService - Batch processing business logic
 * @requires ./useFileProcessing - File operations hook
 * @requires ./useGraphGeneration - Graph generation hook
 * @requires ./ErrorContext - Error handling context
 * @requires ./ConfigContext - Configuration management context
 *
 * @param {Object} props - Component props
 * @param {Object} props.colorSchemes - Available color schemes for visualization
 * @param {Function} props.getAxisIntercepts - Function to calculate axis intercept positions
 * @param {Object} props.logoImage - Logo image for watermarking
 *
 * @exports default Batch
 *
 * @example
 * <Batch 
 *   colorSchemes={schemes} 
 *   getAxisIntercepts={getIntercepts} 
 *   logoImage={logo} 
 * />
 *
 * @relatedFiles BatchProcessingService.js, useFileProcessing.js, useGraphGeneration.js
 */

const Batch = ({ colorSchemes, getAxisIntercepts, logoImage }) => {
    // UI state management
    const [inputFolder, setInputFolder] = useState('');
    const [outputFolder, setOutputFolder] = useState('');
    const [processing, setProcessing] = useState(false);
    const [processedFiles, setProcessedFiles] = useState([]);
    const [jsonConfig, setJsonConfig] = useState(null);
    const [useJsonConfig, setUseJsonConfig] = useState(false);

    // Refs for hidden SVG and Canvas elements
    const svgRef = useRef();
    const canvasRef = useRef();

    // Context hooks
    const { globalSettings, updateGlobalSettings } = useConfig();
    const { handleError } = useError();

    // Custom hooks for file and graph operations
    const { processFile, processJsonConfig, processDirectory, saveFile, resolveConfig } = useFileProcessing();
    const { generateGraph } = useBatchGraphRenderer({
        globalSettings,
        colorSchemes,
        logoImage,
        getAxisIntercepts
    });

    /**
     * Handle JSON configuration file selection
     */
    const selectJsonConfig = async () => {
        try {
            const selected = await open({
                filters: [{ name: 'JSON', extensions: ['json'] }],
                multiple: false,
            });

            if (selected) {
                const config = await processJsonConfig(selected);
                if (config) {
                    setJsonConfig(config);
                    setUseJsonConfig(true);
                }
            }
        } catch (error) {
            handleError(error, 'Failed to select JSON configuration');
        }
    };

    /**
     * Handle input folder selection
     */
    const selectInputFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected) {
                setInputFolder(selected);
            }
        } catch (error) {
            handleError(error, 'Failed to select input folder');
        }
    };

    /**
     * Handle output folder selection
     */
    const selectOutputFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected) {
                setOutputFolder(selected);
            }
        } catch (error) {
            handleError(error, 'Failed to select output folder');
        }
    };

    /**
     * Handle progress updates from batch processing
     * @param {Object} result - Processing result for a single file
     */
    const handleProgress = (result) => {
        setProcessedFiles(prev => [...prev, result]);
    };

    /**
     * Process batch of files using BatchProcessingService
     */
    const processBatch = async () => {
        // Validation
        if (!inputFolder || !outputFolder) {
            handleError(
                new Error('Missing folders'),
                'Please select both input and output folders'
            );
            return;
        }

        if (useJsonConfig && !jsonConfig) {
            handleError(
                new Error('Missing config'),
                'Please select a JSON configuration file'
            );
            return;
        }

        // Initialize processing
        setProcessing(true);
        setProcessedFiles([]);

        try {
            // Create batch processing service
            const service = new BatchProcessingService({
                inputFolder,
                outputFolder,
                globalSettings,
                colorSchemes,
                logoImage,
                getAxisIntercepts,
                generateGraph,
                processFile,
                processDirectory,
                saveFile,
                resolveConfig,
                updateGlobalSettings,
                svgRef,
                canvasRef,
                onProgress: handleProgress,
                onError: handleError
            });

            // Validate configuration
            service.validateConfig();

            // Process batch
            await service.processBatch({
                useJsonConfig,
                jsonConfig
            });
        } catch (error) {
            handleError(error, 'Failed during batch processing');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="batch-container">
            {/* Configuration Card */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Batch Processing</h2>
                </div>
                <div className="card-body">
                    {/* JSON Configuration Toggle */}
                    <div className="batch-config-section">
                        <div className="batch-config-toggle">
                            <input
                                type="checkbox"
                                id="useJsonConfig"
                                className="form-checkbox"
                                checked={useJsonConfig}
                                onChange={(e) => setUseJsonConfig(e.target.checked)}
                            />
                            <label htmlFor="useJsonConfig" className="form-label mb-0">
                                Use JSON Configuration
                            </label>
                        </div>

                        {/* JSON Config Selection */}
                        {useJsonConfig && (
                            <div className="form-group">
                                <button onClick={selectJsonConfig} className="btn btn-outline">
                                    <Settings2 size={16} />
                                    Select JSON Configuration
                                </button>
                                {jsonConfig && (
                                    <div className="batch-folder-path mt-1">
                                        Configuration loaded: {Array.isArray(jsonConfig) ? jsonConfig.length : Object.keys(jsonConfig).length} items
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Folder Selection */}
                    <div className="batch-folder-selection">
                        <div className="batch-folder-item">
                            <label className="batch-folder-label">Input Folder</label>
                            <button onClick={selectInputFolder} className="btn btn-outline w-full">
                                <FolderOpen size={16} />
                                Select Input Folder
                            </button>
                            {inputFolder && (
                                <div className="batch-folder-path">
                                    {inputFolder}
                                </div>
                            )}
                        </div>

                        <div className="batch-folder-item">
                            <label className="batch-folder-label">Output Folder</label>
                            <button onClick={selectOutputFolder} className="btn btn-outline w-full">
                                <FolderOpen size={16} />
                                Select Output Folder
                            </button>
                            {outputFolder && (
                                <div className="batch-folder-path">
                                    {outputFolder}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Process Button */}
                    <div className="batch-actions">
                        <button
                            onClick={processBatch}
                            disabled={processing || !inputFolder || !outputFolder}
                            className={`btn ${processing ? 'btn-secondary' : 'btn-primary'}`}
                        >
                            {processing ? (
                                <>
                                    <div className="spinner" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    Start Batch Processing
                                </>
                            )}
                        </button>
                    </div>

                    {/* Hidden elements for graph generation */}
                    <svg ref={svgRef} className="hidden" width="800" height="600" />
                    <canvas ref={canvasRef} className="hidden" width="800" height="600" />
                </div>
            </div>

            {/* Processing Results */}
            {processedFiles.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Processing Results</h3>
                        <div className="text-sm text-muted">
                            {processedFiles.filter(f => f.status === 'success').length} / {processedFiles.length} successful
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="processing-list">
                            {processedFiles.map((file, index) => (
                                <div key={index} className="processing-item">
                                    <div className="processing-item-info">
                                        {file.status === 'success' ? (
                                            <CheckCircle size={16} className="text-success" />
                                        ) : (
                                            <AlertCircle size={16} className="text-danger" />
                                        )}
                                        <div>
                                            <div className="processing-item-name">{file.name}</div>
                                            <div className="processing-item-message">{file.message}</div>
                                        </div>
                                    </div>
                                    <div className={`processing-status processing-status-${file.status}`}>
                                        {file.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Batch;
