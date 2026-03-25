import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, Download, TrendingUp, FileCode2, Upload } from 'lucide-react';
import * as d3 from 'd3';
import { parseColumnId, calculateAxisIntercepts, performCurveFitting, useConfig, useError, ExportService } from '@siimpli/graph-it-core';
import { useFileManager } from '../hooks/useFileManager.js';
import AppHeader from './AppHeader.jsx';
import FileUploadSection from './FileUploadSection.jsx';
import GraphConfiguration from './GraphConfiguration.jsx';
import GraphRenderer from './GraphRenderer.jsx';
import CurveFittingPanel from './CurveFittingPanel.jsx';
import Batch from './Batch.jsx';
import FilenameDecoder from './FileNameDecoder.jsx';
import '../App.css';
/**
 * @fileoverview Main application component orchestrating the complete data visualization workflow.
 * Integrates file management, graph configuration, rendering, curve fitting, and export functionality
 * to provide a comprehensive scientific data analysis and visualization platform.
 *
 * @author Harison Sharp
 * @since 0.2.0
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library with hooks (useState, useEffect, useCallback)
 * @requires lucide-react - Icon components (BarChart3, Download, TrendingUp)
 * @requires d3 - Data visualization library for mathematical operations
 * @requires ./graphUtils.js - Graph utility functions (parseColumnId)
 * @requires ./curveFittingUtils.js - Mathematical curve fitting operations
 * @requires ./ConfigContext.jsx - Application configuration context provider
 * @requires ./ErrorContext.jsx - Error handling context provider
 * @requires ./ExportService.js - Graph export functionality
 * @requires ./useFileManager.js - File management custom hook
 * @requires ./AppHeader.jsx - Application header component
 * @requires ./FileUploadSection.jsx - File upload interface
 * @requires ./GraphConfiguration.jsx - Graph settings panel
 * @requires ./GraphRenderer.jsx - Core graph rendering component
 * @requires ./CurveFittingPanel.jsx - Curve fitting controls
 * @requires ./Batch.jsx - Batch processing component
 * @requires ./FilenameDecoder.jsx - Filename parsing component
 *
 * @exports default GraphApp
 *
 * @example
 * <GraphApp />
 *
 * @related All application components and services
 */

const GraphApp = () => {
    const [showGraph, setShowGraph] = useState(false);
    const [generationId, setGenerationId] = useState(0);
    const [logoImage, setLogoImage] = useState(null);
    const [logoReady, setLogoReady] = useState(false);
    const [mode, setMode] = useState('manual');
    const [showCurveFitting, setShowCurveFitting] = useState(false);

    // Create refs for SVG and Canvas for export functionality
    const svgRef = useRef();
    const canvasRef = useRef();

    const { graphConfig, curveFits, globalSettings, updateGraphConfig, updateCurveFit, updateGlobalSettings, addCurveFit, removeCurveFit } = useConfig();
    const { handleError, showSuccess } = useError();
    const { csvFiles, csvData, columns, removeFile, handleFileUpload } = useFileManager(graphConfig, updateGraphConfig);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setLogoImage(img);
            setLogoReady(true);
        };
        img.onerror = () => {
            console.warn('Logo failed to load, continuing without logo');
            setLogoReady(true);
        };
        img.src = '/siimpli-graph-it-logo.png';
    }, []);

    const colorSchemes = {
        'warm-cool': d3.interpolateRdYlBu,
        'rainbow': d3.interpolateRainbow,
        'green-red': d3.interpolateRdYlGn
    };

    // Use centralized axis intercept calculation
    const getAxisIntercepts = useCallback((xExtent, yExtent, config = graphConfig) => {
        return calculateAxisIntercepts(xExtent, yExtent, config, globalSettings);
    }, [graphConfig, globalSettings]);

    // Memoize export handler to maintain referential equality
    const exportAsPNG = useCallback(async () => {
        try {
            const result = await ExportService.exportAsPNG(svgRef, canvasRef, csvData, graphConfig, globalSettings, getAxisIntercepts, logoImage);
            if (result) {
                if (result.fallbackUsed) {
                    showSuccess('Export successful (Saved to Downloads)');
                } else {
                    showSuccess('Graph exported successfully');
                }
            }
        } catch (error) {
            handleError(error, 'Failed to export PNG');
        }
    }, [csvData, graphConfig, globalSettings, getAxisIntercepts, logoImage, handleError, showSuccess]);

    // Memoize curve fitting handler to prevent child re-renders
    const performCurveFittingHandler = useCallback(() => {
        try {
            const hasValidSeries = graphConfig.series && graphConfig.series.length > 0 && graphConfig.series.some(s => s.yAxis);
            if (!graphConfig.xAxis || !hasValidSeries || csvData.length === 0) {
                handleError(new Error('No data available'), 'Please load data and select X-axis and at least one Y-axis series before fitting curves');
                return;
            }

            const updatedCurveFits = performCurveFitting(csvData, graphConfig, curveFits);

            updatedCurveFits.forEach((fit, index) => {
                if (index < curveFits.length) {
                    updateCurveFit(index, 'result', fit.result);
                }
            });
        } catch (error) {
            handleError(error, 'Failed to perform curve fitting');
        }
    }, [graphConfig, csvData, curveFits, updateCurveFit, handleError]);

    // Memoize data range calculation to prevent recalculating on every render
    const dataRange = useMemo(() => {
        if (!graphConfig.xAxis || csvData.length === 0) return { min: 0, max: 100 };

        const xAxisInfo = parseColumnId(graphConfig.xAxis);
        const validData = csvData.filter(d =>
            d[xAxisInfo.columnName] !== undefined &&
            !isNaN(+d[xAxisInfo.columnName])
        );

        if (validData.length === 0) return { min: 0, max: 100 };

        const extent = d3.extent(validData, d => +d[xAxisInfo.columnName]);
        return { min: extent[0], max: extent[1] };
    }, [graphConfig.xAxis, csvData]);

    const validData = useMemo(() => {
        if (!graphConfig.xAxis || csvData.length === 0) return [];

        const xAxisInfo = parseColumnId(graphConfig.xAxis);
        return csvData.filter(d =>
            d[xAxisInfo.columnName] !== undefined &&
            !isNaN(+d[xAxisInfo.columnName])
        );
    }, [graphConfig.xAxis, csvData]);

    // Memoize series info for curve fitting
    const seriesInfo = useMemo(() => {
        return graphConfig.series
            .map(s => ({
                ...s,
                yAxisInfo: parseColumnId(s.yAxis)
            }))
            .filter(s => s.yAxisInfo.columnName);
    }, [graphConfig.series]);

    const canGenerateGraph = logoReady && graphConfig.xAxis && graphConfig.series.some(s => s.yAxis) && csvData.length > 0;
    const canExportConfig = csvFiles.length > 0 && graphConfig.xAxis && graphConfig.series.some(s => s.yAxis);

    const exportConfigAsJSON = useCallback(async () => {
        if (!canExportConfig) {
            handleError(new Error('Incomplete configuration'), 'Load at least one CSV and select axes before exporting JSON');
            return;
        }

        const sanitizeDatasetId = (fileName = '', fallbackIndex = 0) => {
            const slug = fileName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            return slug || `dataset-${fallbackIndex + 1}`;
        };

        const buildDatasetBindings = () => {
            if (!columns.length && !csvFiles.length) return [];

            const grouped = new Map();

            columns.forEach((col) => {
                const fileKey = col.file || 'dataset';
                if (!grouped.has(fileKey)) {
                    grouped.set(fileKey, []);
                }
                grouped.get(fileKey).push({
                    id: col.uniqueId || `${fileKey}::${col.name || 'column'}`,
                    name: col.name || col.uniqueId || 'Column',
                    type: col.type || col.dataType,
                    unit: col.unit || col.units,
                    file: col.file
                });
            });

            csvFiles.forEach((file) => {
                if (grouped.has(file.name)) return;
                const headerColumns = (file.headers || []).map((header) => ({
                    id: `${file.name}::${header}`,
                    name: header,
                    file: file.name
                }));
                grouped.set(file.name, headerColumns);
            });

            return Array.from(grouped.entries()).map(([fileName, cols], index) => ({
                id: sanitizeDatasetId(fileName, index),
                file: fileName,
                columns: cols.filter(Boolean).map((col, colIndex) => ({
                    id: col.id || `${fileName || 'dataset'}::column-${colIndex + 1}`,
                    name: col.name || `Column ${colIndex + 1}`,
                    type: col.type,
                    unit: col.unit
                }))
            }));
        };

        try {
            const datasetBindings = buildDatasetBindings();
            const graphPayload = JSON.parse(JSON.stringify(graphConfig));
            const globalPayload = JSON.parse(JSON.stringify({
                ...globalSettings,
                graphDimensions: globalSettings.graphDimensions || { width: 800, height: 600 }
            }));

            const configPayload = {
                version: '1.0.0',
                metadata: {
                    generatedAt: new Date().toISOString(),
                    source: 'GraphApp UI'
                },
                ...(datasetBindings.length ? { dataBindings: { datasets: datasetBindings } } : {}),
                graph: graphPayload,
                global: globalPayload
            };

            const jsonString = JSON.stringify(configPayload, null, 2);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `graph-config-${timestamp}.json`;

            const supportsFilePicker = typeof window !== 'undefined' && window.showSaveFilePicker;

            if (supportsFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: 'JSON Configuration',
                            accept: { 'application/json': ['.json'] }
                        }
                    ]
                });
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
            } else {
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            showSuccess('Configuration JSON saved');
        } catch (error) {
            handleError(error, 'Failed to export configuration JSON');
        }
    }, [canExportConfig, columns, csvFiles, graphConfig, globalSettings, handleError, showSuccess]);

    const importConfigFromJSON = useCallback(async () => {
        const supportsFilePicker = typeof window !== 'undefined' && window.showOpenFilePicker;

        let jsonString;
        try {
            if (supportsFilePicker) {
                const [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'JSON Configuration', accept: { 'application/json': ['.json'] } }],
                    multiple: false
                });
                const file = await handle.getFile();
                jsonString = await file.text();
            } else {
                jsonString = await new Promise((resolve, reject) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json,application/json';
                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (!file) { reject(new Error('No file selected')); return; }
                        resolve(await file.text());
                    };
                    input.oncancel = () => reject(new Error('Cancelled'));
                    input.click();
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError' && error.message !== 'Cancelled') {
                handleError(error, 'Failed to open file');
            }
            return;
        }

        let config;
        try {
            config = JSON.parse(jsonString);
        } catch {
            handleError(new Error('Invalid JSON'), 'The selected file is not valid JSON');
            return;
        }

        if (!config.version || !config.graph || !config.global) {
            handleError(new Error('Invalid config'), 'JSON does not match the expected graph config schema (missing version, graph, or global)');
            return;
        }

        updateGraphConfig(config.graph);
        updateGlobalSettings(config.global);
        showSuccess('Configuration imported successfully');
    }, [updateGraphConfig, updateGlobalSettings, handleError, showSuccess]);

    const handleGenerateGraph = () => {
        console.log('Generating graph... ID:', generationId + 1);
        setShowGraph(true);
        setGenerationId(prev => prev + 1);
    };

    return (
        <div className="app-container">
            <AppHeader mode={mode} setMode={setMode} />

            <main className="app-main">
                {mode === 'manual' && (
                    <>
                        <FileUploadSection
                            csvFiles={csvFiles}
                            onFileUpload={handleFileUpload}
                            onRemoveFile={removeFile}
                        />

                        {csvFiles.length > 0 && (
                            <section className="app-section">
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Graph Configuration</h2>
                                        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                            Configure your graph settings and data visualization options
                                        </p>
                                    </div>
                                    <GraphConfiguration
                                        data={validData}
                                        columns={columns}
                                        graphConfig={graphConfig}
                                        globalSettings={globalSettings}
                                        updateGraphConfig={updateGraphConfig}
                                        updateGlobalSettings={updateGlobalSettings}
                                    />

                                    <div className="card-footer">
                                        <div className="graph-controls">
                                            <button type="button"
                                                className="btn btn-primary btn-lg"
                                                onClick={handleGenerateGraph}
                                                disabled={!canGenerateGraph}
                                                title={!logoReady ? 'Loading logo...' : !canGenerateGraph ? 'Please select X and Y axes' : ''}
                                            >
                                                <BarChart3 size={18} />
                                                Generate Graph ({generationId})
                                                {!logoReady && <span className="spinner" />}
                                            </button>

                                            <button
                                                className="btn btn-secondary" type="button"
                                                onClick={importConfigFromJSON}
                                            >
                                                <Upload size={16} />
                                                Import Config JSON
                                            </button>

                                            {showGraph && (
                                                <>
                                                    <button className="btn btn-success" type="button" onClick={exportAsPNG}>
                                                        <Download size={16} />
                                                        Export as PNG
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary" type="submit"
                                                        onClick={exportConfigAsJSON}
                                                        disabled={!canExportConfig}
                                                        title={!canExportConfig ? 'Load data and select axes to export JSON' : ''}
                                                    >
                                                        <FileCode2 size={16} />
                                                        Export Config JSON
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                className="btn btn-secondary" type="button"
                                                onClick={() => setShowCurveFitting(!showCurveFitting)}
                                            >
                                                <TrendingUp size={16} />
                                                {showCurveFitting ? 'Hide' : 'Show'} Curve Fitting
                                            </button>
                                        </div>

                                        {showCurveFitting && (
                                            <CurveFittingPanel
                                                curveFits={curveFits}
                                                dataRange={dataRange}
                                                onPerformFitting={performCurveFittingHandler}
                                                updateCurveFit={updateCurveFit}
                                                addCurveFit={addCurveFit}
                                                removeCurveFit={removeCurveFit}
                                                seriesInfo={seriesInfo}
                                            />
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {showGraph && (
                            <section className="app-section">
                                <GraphRenderer
                                    key={generationId}
                                    csvData={csvData}
                                    graphConfig={graphConfig}
                                    curveFits={curveFits}
                                    globalSettings={globalSettings}
                                    logoImage={logoImage}
                                    logoReady={logoReady}
                                    getAxisIntercepts={getAxisIntercepts}
                                    onGraphGenerated={setShowGraph}
                                    svgRef={svgRef}
                                    canvasRef={canvasRef}
                                    updateGlobalSettings={updateGlobalSettings}
                                />
                            </section>
                        )}
                    </>
                )}

                {mode === 'batch' && (
                    <Batch
                        colorSchemes={colorSchemes}
                        getAxisIntercepts={getAxisIntercepts}
                        logoImage={logoImage}
                    />
                )}

                {mode === 'decoder' && (
                    <FilenameDecoder />
                )}
            </main>
        </div>
    );
};

export default GraphApp;
