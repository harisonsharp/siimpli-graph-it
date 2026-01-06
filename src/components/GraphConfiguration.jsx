import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useConfig } from '../contexts/ConfigContext';
import { detectTypeConflict, resolveTypeConflict, validateSecondaryAxisTypes } from '@siimpli/graph-it-core';

const GraphConfiguration = ({
    columns,
    graphConfig,
    globalSettings,
    updateGraphConfig,
    updateGlobalSettings
}) => {
    const { addSeries, removeSeries, updateSeries } = useConfig();
    const [conflictWarning, setConflictWarning] = useState(null);

    const handleBarModeChange = (e) => {
        updateGraphConfig({ barMode: e.target.value });
    };

    // Check for type conflicts when series configuration changes
    useEffect(() => {
        const primarySeries = graphConfig.series.filter(s => s.axisAssignment !== 'secondary');
        const secondarySeries = graphConfig.series.filter(s => s.axisAssignment === 'secondary');

        // First, validate secondary axis consistency
        const validation = validateSecondaryAxisTypes(secondarySeries);
        if (!validation.isValid) {
            setConflictWarning({
                type: 'validation',
                message: validation.message
            });
            return;
        }

        // Then check for conflicts with primary axis
        const conflict = detectTypeConflict(primarySeries, secondarySeries);
        if (conflict && conflict.hasConflict) {
            // Auto-resolve the conflict
            const { updatedSeries, changes } = resolveTypeConflict(graphConfig.series, conflict);

            if (changes.length > 0) {
                // Show warning about the changes made
                const changeMessage = changes.map(c =>
                    `Series ${c.seriesIndex + 1}: ${c.oldType} → ${c.newType}`
                ).join('; ');

                setConflictWarning({
                    type: 'conflict',
                    message: `Type conflict detected and resolved: ${changeMessage}`,
                    details: `The secondary axis is using ${conflict.secondaryType}, so primary axis series cannot use this type.`
                });

                // Update the configuration with resolved series
                updateGraphConfig({ series: updatedSeries });
            }
        } else {
            setConflictWarning(null);
        }
    }, [graphConfig.series]);

    const handleAxisAssignmentChange = (index, value) => {
        updateSeries(index, { axisAssignment: value });
    };

    const handleGraphTypeChange = (index, value) => {
        const updates = { graphType: value };
        if (value === 'histogram') {
            updates.yAxis = '__frequency__';
        }
        updateSeries(index, updates);
    };

    const hasBarSeries = graphConfig.series.some(s => s.graphType === 'bar');

    return (
        <div className="card-body">
            {conflictWarning && (
                <div
                    style={{
                        padding: '12px',
                        marginBottom: '16px',
                        backgroundColor: conflictWarning.type === 'conflict' ? '#fff3cd' : '#f8d7da',
                        border: `1px solid ${conflictWarning.type === 'conflict' ? '#ffc107' : '#dc3545'}`,
                        borderRadius: '4px',
                        color: '#333'
                    }}
                >
                    <strong>⚠️ {conflictWarning.type === 'conflict' ? 'Auto-Resolved' : 'Validation Error'}:</strong>
                    <div style={{ marginTop: '4px' }}>{conflictWarning.message}</div>
                    {conflictWarning.details && (
                        <div style={{ marginTop: '4px', fontSize: '13px', opacity: 0.9 }}>
                            {conflictWarning.details}
                        </div>
                    )}
                </div>
            )}
            <div className="graph-settings">
                {/* Graph Title and Axis Labels */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" htmlFor="graph-title">Graph Title</label>
                    <input
                        id="graph-title"
                        type="text"
                        className="form-input"
                        placeholder="Auto-generated from data if left empty"
                        value={graphConfig.title || ''}
                        onChange={(e) => updateGraphConfig({ title: e.target.value })}
                    />
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Leave empty to auto-generate title from selected columns
                    </p>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="x-axis-column">
                        X-Axis Column
                        <span style={{ color: 'var(--danger-color)', marginLeft: '4px' }}>*</span>
                    </label>
                    <select
                        id="x-axis-column"
                        className="form-select"
                        value={graphConfig.xAxis}
                        onChange={(e) => updateGraphConfig({ xAxis: e.target.value })}
                    >
                        <option value="">Select a column for X-axis...</option>
                        {columns.map(col => (
                            <option key={col.uniqueId} value={col.uniqueId}>
                                {col.name} ({col.file})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="x-axis-label">X-Axis Label (Optional)</label>
                    <input
                        id="x-axis-label"
                        type="text"
                        className="form-input"
                        placeholder="Uses column name if empty"
                        value={graphConfig.xAxisLabel || ''}
                        onChange={(e) => updateGraphConfig({ xAxisLabel: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="y-axis-label">Primary Y-Axis Label (Optional)</label>
                    <input
                        id="y-axis-label"
                        type="text"
                        className="form-input"
                        placeholder="Uses series names if empty"
                        value={graphConfig.yAxisLabel || ''}
                        onChange={(e) => updateGraphConfig({ yAxisLabel: e.target.value })}
                    />
                </div>

                {graphConfig.series.some(s => s.axisAssignment === 'secondary') && (
                    <div className="form-group">
                        <label className="form-label" htmlFor="y-axis-label-2">Secondary Y-Axis Label (Optional)</label>
                        <input
                            id="y-axis-label-2"
                            type="text"
                            className="form-input"
                            placeholder="Uses secondary series names if empty"
                            value={graphConfig.yAxisLabel2 || ''}
                            onChange={(e) => updateGraphConfig({ yAxisLabel2: e.target.value })}
                        />
                    </div>
                )}                <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--spacing-lg)',
                        paddingBottom: 'var(--spacing-md)',
                        borderBottom: '2px solid var(--border-light)'
                    }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-color)' }}>
                            Data Series Configuration
                        </h4>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={addSeries}
                            title="Add a new data series"
                        >
                            Add Series
                        </button>
                    </div>
                </div>

                {graphConfig.series.map((series, index) => (
                    <div key={index} className="series-config" style={{ gridColumn: '1 / -1' }}>
                        <div className="series-header">
                            <h5>Series {index + 1}</h5>
                            {graphConfig.series.length > 1 && (
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => removeSeries(index)}
                                    title="Remove this series"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        <div className="series-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor={`series-y-axis-${index}`}>
                                        Y-Axis Column
                                        <span style={{ color: 'var(--danger-color)', marginLeft: '4px' }}>*</span>
                                    </label>
                                    <select
                                        id={`series-y-axis-${index}`}
                                        className="form-select"
                                        value={series.yAxis}
                                        onChange={(e) => updateSeries(index, { yAxis: e.target.value })}
                                    >
                                        <option value="">Select a column for Y-axis...</option>
                                        <option value="__frequency__">Frequency (Calculated)</option>
                                        {columns.map(col => (
                                            <option key={col.uniqueId} value={col.uniqueId}>
                                                {col.name} ({col.file})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor={`series-axis-assignment-${index}`}>Axis Assignment</label>
                                    <select
                                        id={`series-axis-assignment-${index}`}
                                        className="form-select"
                                        value={series.axisAssignment || 'primary'}
                                        onChange={(e) => handleAxisAssignmentChange(index, e.target.value)}
                                    >
                                        <option value="primary">Primary Y-Axis (Left)</option>
                                        <option value="secondary">Secondary Y-Axis (Right)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor={`series-graph-type-${index}`}>Visualization Type</label>
                                    <select
                                        id={`series-graph-type-${index}`}
                                        className="form-select"
                                        value={series.graphType}
                                        onChange={(e) => handleGraphTypeChange(index, e.target.value)}
                                    >
                                        <option value="scatter">Scatter Plot</option>
                                        <option value="line">Line Chart</option>
                                        <option value="bar">Bar Chart</option>
                                        <option value="histogram">Histogram</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor={`series-color-${index}`}>Series Color</label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            id={`series-color-${index}`}
                                            type="color"
                                            className="form-input form-input-color"
                                            value={series.color || '#000000'}
                                            onBlur={(e) => updateSeries(index, { color: e.target.value })}
                                            style={{ width: '50px', padding: '2px', height: '38px' }}
                                        />
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={series.color || ''}
                                            placeholder="Auto"
                                            onChange={(e) => updateSeries(index, { color: e.target.value })}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {series.graphType === 'bar' && (
                                <div className="form-row" style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`series-bar-mode-${index}`}>Bar Mode</label>
                                        <select
                                            id={`series-bar-mode-${index}`}
                                            className="form-select"
                                            value={series.barMode || 'group'}
                                            onChange={(e) => updateSeries(index, { barMode: e.target.value })}
                                        >
                                            <option value="group">Grouped</option>
                                            <option value="stack">Stacked</option>
                                        </select>
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '8px' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={series.showConfidenceInterval || false}
                                                onChange={(e) => updateSeries(index, { showConfidenceInterval: e.target.checked })}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <span>Show Confidence Interval (95%)</span>
                                        </label>
                                    </div>

                                    {series.showConfidenceInterval && (
                                        <div className="form-group">
                                            <label className="form-label" htmlFor={`series-ci-level-${index}`}>Confidence Level (%)</label>
                                            <input
                                                id={`series-ci-level-${index}`}
                                                type="number"
                                                min="1"
                                                max="99"
                                                className="form-input"
                                                value={series.confidenceLevel || 95}
                                                onChange={(e) => {
                                                    const val = Math.min(99, Math.max(1, parseInt(e.target.value) || 95));
                                                    updateSeries(index, { confidenceLevel: val });
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {series.graphType === 'line' && (
                                <div className="form-row" style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`series-curve-type-${index}`}>Curve Type</label>
                                        <select
                                            id={`series-curve-type-${index}`}
                                            className="form-select"
                                            value={series.curveType || 'curveMonotoneX'}
                                            onChange={(e) => updateSeries(index, { curveType: e.target.value })}
                                        >
                                            <option value="curveLinear">Linear (Straight)</option>
                                            <option value="curveMonotoneX">Smooth (Monotone)</option>
                                            <option value="curveStep">Step</option>
                                            <option value="curveStepAfter">Step After</option>
                                            <option value="curveStepBefore">Step Before</option>
                                            <option value="curveBasis">Basis (Spline)</option>
                                            <option value="curveNatural">Natural</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`series-line-style-${index}`}>Line Style</label>
                                        <select
                                            id={`series-line-style-${index}`}
                                            className="form-select"
                                            value={series.lineStyle || 'solid'}
                                            onChange={(e) => updateSeries(index, { lineStyle: e.target.value })}
                                        >
                                            <option value="solid">Solid</option>
                                            <option value="dashed">Dashed</option>
                                            <option value="dotted">Dotted</option>
                                            <option value="dash-dot">Dash-Dot</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={series.showPoints || false}
                                                onChange={(e) => updateSeries(index, { showPoints: e.target.checked })}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <span>Show Points</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" htmlFor="color-scheme">Color Scheme</label>
                    <select
                        id="color-scheme"
                        className="form-select"
                        value={globalSettings.colorScheme}
                        onChange={(e) => updateGlobalSettings({ colorScheme: e.target.value })}
                    >
                        <option value="green-red">Green to Red</option>
                        <option value="warm-cool">Warm to Cool</option>
                        <option value="rainbow">Rainbow Spectrum</option>
                    </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-color)' }}>Axis Intercepts</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="intercept-mode">Intercept Mode</label>
                            <select
                                id="intercept-mode"
                                className="form-select"
                                value={graphConfig.axisIntercept || 'origin'}
                                onChange={(e) => updateGraphConfig({ axisIntercept: e.target.value })}
                            >
                                <option value="origin">Origin (0,0)</option>
                                <option value="minimum">Minimum Values</option>
                                <option value="custom">Custom Coordinates</option>
                            </select>
                        </div>
                    </div>

                    {graphConfig.axisIntercept === 'custom' && (
                        <div className="form-row" style={{ marginTop: '8px' }}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="custom-intercept-x">X Coordinate</label>
                                <input
                                    id="custom-intercept-x"
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    value={graphConfig.customIntercept?.x ?? 0}
                                    onChange={(e) => updateGraphConfig({
                                        customIntercept: {
                                            ...graphConfig.customIntercept,
                                            x: Number.parseFloat(e.target.value)
                                        }
                                    })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="custom-intercept-y">Y Coordinate</label>
                                <input
                                    id="custom-intercept-y"
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    value={graphConfig.customIntercept?.y ?? 0}
                                    onChange={(e) => updateGraphConfig({
                                        customIntercept: {
                                            ...graphConfig.customIntercept,
                                            y: Number.parseFloat(e.target.value)
                                        }
                                    })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" htmlFor="show-guide-lines" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            id="show-guide-lines"
                            type="checkbox"
                            checked={globalSettings.showGuideLines || false}
                            onChange={(e) => updateGlobalSettings({ showGuideLines: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>Show Guide Lines (faint grid)</span>
                    </label>
                    <p style={{ margin: '4px 0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Display faint horizontal and vertical guide lines as visual aids
                    </p>
                </div>
            </div >
        </div >
    );
};

GraphConfiguration.propTypes = {
    columns: PropTypes.arrayOf(PropTypes.shape({
        uniqueId: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        file: PropTypes.string
    })).isRequired,
    graphConfig: PropTypes.shape({
        title: PropTypes.string,
        xAxis: PropTypes.string,
        xAxisLabel: PropTypes.string,
        yAxisLabel: PropTypes.string,
        yAxisLabel2: PropTypes.string,
        series: PropTypes.arrayOf(PropTypes.shape({
            yAxis: PropTypes.string,
            axisAssignment: PropTypes.string,
            graphType: PropTypes.string
        })).isRequired,
        barMode: PropTypes.string,
        colorGrading: PropTypes.string,
        contouring: PropTypes.string,
        axisIntercept: PropTypes.string,
        customIntercept: PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number,
            y2: PropTypes.number
        })
    }).isRequired,
    globalSettings: PropTypes.shape({
        colorScheme: PropTypes.string,
        showGuideLines: PropTypes.bool
    }).isRequired,
    updateGraphConfig: PropTypes.func.isRequired,
    updateGlobalSettings: PropTypes.func.isRequired
};

export default GraphConfiguration;
