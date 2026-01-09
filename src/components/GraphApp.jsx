import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, Download, TrendingUp } from 'lucide-react';
import * as d3 from 'd3';
import { parseColumnId, calculateAxisIntercepts, performCurveFitting } from '@siimpli/graph-it-core';
import { useConfig } from '../contexts/ConfigContext.jsx';
import { useError } from '../contexts/ErrorContext.jsx';
import { ExportService } from '@siimpli/graph-it-core';
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
    const { csvFiles, csvData, columns, removeFile, handleFileUpload } = useFileManager(updateGraphConfig);

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
        img.src = '/SIIMLogoOffWhiteBackground.png';
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
                                            <button
                                                className="btn btn-primary btn-lg"
                                                onClick={handleGenerateGraph}
                                                disabled={!canGenerateGraph}
                                                title={!logoReady ? 'Loading logo...' : !canGenerateGraph ? 'Please select X and Y axes' : ''}
                                            >
                                                <BarChart3 size={18} />
                                                Generate Graph ({generationId})
                                                {!logoReady && <span className="spinner" />}
                                            </button>

                                            {showGraph && (
                                                <button className="btn btn-success" onClick={exportAsPNG}>
                                                    <Download size={16} />
                                                    Export as PNG
                                                </button>
                                            )}

                                            <button
                                                className="btn btn-secondary"
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
