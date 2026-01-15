import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useConfig } from '../contexts/ConfigContext';
import { debugLog, MathUtils, detectTypeConflict, resolveTypeConflict, SymbolFactory, validateSecondaryAxisTypes, ScaleFactory } from '@siimpli/graph-it-core';

const GraphConfiguration = ({
    data,
    columns,
    graphConfig,
    globalSettings,
    updateGraphConfig,
    updateGlobalSettings
}) => {
    debugLog('GraphConfiguration', { columns, graphConfig, globalSettings });
    const { addSeries, removeSeries, updateSeries, moveSeries } = useConfig();
    const [conflictWarning, setConflictWarning] = useState(null);
    const [collapsedSeries, setCollapsedSeries] = useState(new Set());
    const [draggedSeriesIndex, setDraggedSeriesIndex] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedSeriesIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
        // Set drag image or styling here if needed
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));

        if (sourceIndex !== targetIndex) {
            moveSeries(sourceIndex, targetIndex);

            // Handle collapsed state update to follow the series
            setCollapsedSeries(prev => {
                const next = new Set();
                const wasSourceCollapsed = prev.has(sourceIndex);

                // Rebuild the set based on new indices
                prev.forEach(oldIndex => {
                    if (oldIndex === sourceIndex) return; // Handled separately

                    let newIndex = oldIndex;
                    if (sourceIndex < targetIndex) {
                        // Moving down: items between source and target shift up
                        if (oldIndex > sourceIndex && oldIndex <= targetIndex) {
                            newIndex--;
                        }
                    } else {
                        // Moving up: items between target and source shift down
                        if (oldIndex >= targetIndex && oldIndex < sourceIndex) {
                            newIndex++;
                        }
                    }
                    next.add(newIndex);
                });

                if (wasSourceCollapsed) {
                    next.add(targetIndex);
                }

                return next;
            });
        }
        setDraggedSeriesIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedSeriesIndex(null);
    };

    const toggleSeriesCollapse = (index) => {
        setCollapsedSeries(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

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
                )}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" htmlFor="join-x-axis" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            id="join-x-axis"
                            type="checkbox"
                            checked={globalSettings.joinXAxis || false}
                            onChange={(e) => updateGlobalSettings({ joinXAxis: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>Join X-Axis</span>
                    </label>

                    <p style={{ margin: '4px 0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Join multiple X-Axes into a single axis
                    </p>

                </div>
                {globalSettings.joinXAxis && (
                    <div className="form-group" style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '4px', marginTop: '8px' }}>
                        <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                            Join Columns
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '8px', fontSize: '12px' }}>
                                (Priority: Primary X → Join Col 1 → Join Col 2...)
                            </span>
                        </label>

                        {/* Render existing join columns */}
                        {(graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : [])).map((joinColId, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <select
                                    className="form-select"
                                    value={joinColId}
                                    onChange={(e) => {
                                        const newJoinColumns = [...(graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : []))];
                                        newJoinColumns[index] = e.target.value;
                                        updateGraphConfig({ joinColumns: newJoinColumns, xAxis2: newJoinColumns[0] }); // Keep xAxis2 synced for now
                                    }}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Select a column to join...</option>
                                    {columns.map(col => (
                                        <option key={col.uniqueId} value={col.uniqueId}>
                                            {col.name} ({col.file})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => {
                                        const newJoinColumns = (graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : [])).filter((_, i) => i !== index);
                                        updateGraphConfig({ joinColumns: newJoinColumns, xAxis2: newJoinColumns[0] || '' });
                                    }}
                                    title="Remove this join column"
                                    style={{ padding: '0 8px' }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                                const newJoinColumns = [...(graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : [])), ''];
                                updateGraphConfig({ joinColumns: newJoinColumns });
                            }}
                            style={{ width: '100%', marginTop: '4px' }}
                        >
                            + Add Column to Join
                        </button>
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
                    <div
                        key={index}
                        className="series-config"
                        style={{
                            gridColumn: '1 / -1',
                            opacity: draggedSeriesIndex === index ? 0.4 : 1,
                            border: draggedSeriesIndex === index ? '2px dashed var(--primary-color)' : undefined,
                            transition: 'opacity 0.2s, transform 0.2s'
                        }}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="series-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab' }} onClick={() => toggleSeriesCollapse(index)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    transform: collapsedSeries.has(index) ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                    display: 'inline-block'
                                }}>▼</span>
                                <h5 style={{ margin: 0 }}>Series {index + 1} {series.titleName ? `(${series.titleName})` : ''}</h5>
                            </div>
                            {graphConfig.series.length > 1 && (
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeSeries(index);
                                    }}
                                    title="Remove this series"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        {!collapsedSeries.has(index) && (
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
                                        <label className="form-label" htmlFor={`series-title-name-${index}`}>
                                            Name (optional)
                                        </label>
                                        <input
                                            id={`series-title-name-${index}`}
                                            className="form-input"
                                            value={series.titleName}
                                            onChange={(e) => updateSeries(index, { titleName: e.target.value })}
                                        />
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
                                                value={ScaleFactory.resolveColor(series.color) || '#000000'}
                                                onChange={(e) => updateSeries(index, { color: e.target.value })}
                                                style={{ width: '50px', padding: '2px', height: '38px' }}
                                            />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={series.color || ''}
                                                placeholder="Auto"
                                                list="color-names"
                                                onChange={(e) => updateSeries(index, { color: e.target.value })}
                                                style={{ flex: 1 }}
                                            />
                                        </div>
                                        <datalist id="color-names">
                                            {Object.keys(ScaleFactory.CUSTOM_COLOR_MAP).map(key => (
                                                <option key={key} value={key} />
                                            ))}
                                        </datalist>
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
                                        <div className="form-group">
                                            <label className="form-label" htmlFor={`series-stroke-width-${index}`}>
                                                Stroke Width
                                            </label>
                                            <input
                                                id={`series-stroke-width-${index}`}
                                                className="form-input"
                                                value={series.strokeWidth}
                                                onChange={(e) => updateSeries(index, { strokeWidth: e.target.value })}
                                            />
                                        </div>

                                    </div>
                                )}
                                {series.graphType === 'scatter' && (
                                    <div className="form-row" style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor={`series-stroke-width-${index}`}>
                                                Dot Size
                                            </label>
                                            <input
                                                id={`series-stroke-width-${index}`}
                                                className="form-input"
                                                value={series.strokeWidth}
                                                onChange={(e) => updateSeries(index, { strokeWidth: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginLeft: '20px' }} >
                                            {/* checkbox for "filter" */}
                                            <label className="form-label" htmlFor={`series-filter-${index}`}>
                                                Filter
                                            </label>
                                            <input
                                                id={`series-filter-${index}`}
                                                type="checkbox"
                                                checked={series.filter}
                                                onChange={(e) => updateSeries(index, { filter: e.target.checked })}
                                            />
                                        </div>
                                        {series.filter &&

                                            <div className="form-group">
                                                <label className="form-label" htmlFor={`series-filter-column-${index}`}>
                                                    Filter Column
                                                    <span style={{ color: 'var(--danger-color)', marginLeft: '4px' }}>*</span>
                                                </label>
                                                <select
                                                    id={`series-filter-column-${index}`}
                                                    className="form-select"
                                                    value={series.filterColumn}
                                                    onChange={(e) => updateSeries(index, { filterColumn: e.target.value })}
                                                >
                                                    <option value="">Select a column for filter...</option>
                                                    {columns.map(col => (
                                                        <option key={col.uniqueId} value={col.uniqueId}>
                                                            {col.name} ({col.file})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        }
                                        <div className="form-group" >
                                            {/* filter settings: select filter type */}
                                            <label className="form-label" htmlFor={`series-filter-type-${index}`}>
                                                Filter Type
                                            </label>
                                            <select
                                                id={`series-filter-type-${index}`}
                                                className="form-select"
                                                value={series.filterType}
                                                onChange={(e) => {
                                                    if (e.target.value === 'unique') {
                                                        const uniqueValues = SymbolFactory.getUniqueValues(data, series.filterColumn.split('::')[0]);
                                                        updateSeries(index, { filterType: e.target.value, uniqueValues: uniqueValues, symbolMap: SymbolFactory.getSymbolMap(uniqueValues) });
                                                    } else {
                                                        updateSeries(index, { filterType: e.target.value });
                                                    }
                                                }}
                                            >
                                                <option value="equals">Equals</option>
                                                <option value="not-equals">Not Equals</option>
                                                <option value="greater-than">Greater Than</option>
                                                <option value="less-than">Less Than</option>
                                                <option value="unique">Unique</option>
                                            </select>
                                        </div>

                                        {series.filterType === 'unique' && (
                                            <div className="form-group">
                                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '28px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={series.excludeEmptyValues || false}
                                                        onChange={(e) => updateSeries(index, { excludeEmptyValues: e.target.checked })}
                                                    />
                                                    <span>Exclude Empty Values</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
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
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-color)' }}>Graph Scaling</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="width-multiplier">Width Multiplier</label>
                            <input
                                id="width-multiplier"
                                type="number"
                                min="0.1"
                                step="0.1"
                                className="form-input"
                                value={graphConfig.widthMultiplier || 1.0}
                                onChange={(e) => updateGraphConfig({ widthMultiplier: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="height-multiplier">Height Multiplier</label>
                            <input
                                id="height-multiplier"
                                type="number"
                                min="0.1"
                                step="0.1"
                                className="form-input"
                                value={graphConfig.heightMultiplier || 1.0}
                                onChange={(e) => updateGraphConfig({ heightMultiplier: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
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


            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="show-data-table" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        id="show-data-table"
                        type="checkbox"
                        checked={globalSettings.showDataTable || false}
                        onChange={(e) => updateGlobalSettings({ showDataTable: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                    />
                    <span>Show Data Table</span>
                </label>

                <p style={{ margin: '4px 0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Display a table of values at the current cursor position
                </p>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <label className="form-label" htmlFor="show-static-table" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: 0 }}>
                        <input
                            id="show-static-table"
                            type="checkbox"
                            checked={globalSettings.showStaticTable || false}
                            onChange={(e) => updateGlobalSettings({ showStaticTable: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>Show Static Table (for Export)</span>
                    </label>

                    {globalSettings.showStaticTable && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label className="form-label" htmlFor="selected-x-value" style={{ marginBottom: 0 }}>
                                X Value:
                            </label>
                            <input
                                id="selected-x-value"
                                type="number"
                                step="any"
                                className="form-input"
                                style={{ width: '100px', padding: '2px 8px' }}
                                value={globalSettings.selectedXValue !== null ? globalSettings.selectedXValue : ''}
                                onChange={(e) => updateGraphConfig({ selectedXValue: e.target.value === '' ? null : parseFloat(e.target.value) })}
                                placeholder="Click graph"
                            />
                        </div>
                    )}
                </div>
                <p style={{ margin: '4px 0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Display a persistent table below the legend. Click graph or enter value to update.
                </p>

                {globalSettings.showStaticTable && (
                    <label className="form-label" htmlFor="show-unified-table" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', marginLeft: '24px' }}>
                        <input
                            id="show-unified-table"
                            type="checkbox"
                            checked={globalSettings.showUnifiedTable || false}
                            onChange={(e) => updateGlobalSettings({ showUnifiedTable: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>Unified Table (Legend + Values)</span>
                    </label>
                )}

                {globalSettings.showStaticTable && globalSettings.showUnifiedTable && (
                    <div style={{ marginTop: '8px', marginLeft: '24px' }}>
                        <label className="form-label" htmlFor="show-bias-table" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                id="show-bias-table"
                                type="checkbox"
                                checked={globalSettings.showBiasTable || false}
                                onChange={(e) => updateGlobalSettings({ showBiasTable: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <span>Show Bias Table</span>
                        </label>

                        {globalSettings.showBiasTable && (
                            <div style={{ marginTop: '8px', marginLeft: '24px' }}>
                                <label className="form-label" htmlFor="bias-table-file" style={{ marginBottom: '4px', display: 'block' }}>
                                    Bias CSV File
                                </label>
                                <input
                                    id="bias-table-file"
                                    type="file"
                                    accept=".csv"
                                    className="form-input"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                const text = event.target.result;
                                                // Parse CSV
                                                const lines = text.split('\n').filter(l => l.trim());
                                                if (lines.length > 0) {
                                                    const headers = lines[0].split(',').map(h => h.trim());
                                                    const rows = lines.slice(1).map(line => {
                                                        const values = line.split(',').map(v => v.trim());
                                                        const row = {};
                                                        headers.forEach((h, i) => { row[h] = values[i]; });
                                                        return row;
                                                    });
                                                    updateGlobalSettings({ biasTableData: rows, biasTableFile: file.name });
                                                }
                                            };
                                            reader.readAsText(file);
                                        }
                                    }}
                                    style={{ padding: '8px' }}
                                />
                                {globalSettings.biasTableFile && (
                                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        Loaded: {globalSettings.biasTableFile}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/*  two new form groups: a checkbox for "dual units" and two selects for the units to convert to and from */}
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / 2' }}>
                    <label className="form-label" htmlFor="dual-units" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            id="dual-units"
                            type="checkbox"
                            checked={graphConfig.dualUnits}
                            onChange={(e) => updateGraphConfig({ dualUnits: e.target.checked, scaleFactor: MathUtils.dmtToUnitFactor(globalSettings.fromUnits || 'USD$/dmt') })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>Dual Units</span>
                    </label>

                    <p style={{ margin: '4px 0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Convert values to and from different units
                    </p>
                </div>
                {/* a dropdown select for the units to convert from */}
                {graphConfig.dualUnits && (
                    <div className="form-group" style={{ gridColumn: '2 / 3' }}>
                        <label className="form-label" htmlFor="from-units">From Units</label>
                        <select
                            id="from-units"
                            className="form-select"
                            value={graphConfig.fromUnits}
                            onChange={(e) => updateGraphConfig({ fromUnits: e.target.value, scaleFactor: MathUtils.dmtToUnitFactor(e.target.value, graphConfig.toUnits || 'USD$/dmt') })}
                        >
                            <option value=""> Select a Unit ...</option>
                            <option value="USD$/dmt">USD$/dmt</option>
                            <option value="USD$/lbs">USD$/lbs</option>
                            <option value="USD$/oz">USD$/oz</option>
                        </select>
                    </div>
                )}
                {/* a dropdown select for the units to convert to */}
                {graphConfig.dualUnits && (
                    <div className="form-group" style={{ gridColumn: '3 / 4' }}>
                        <label className="form-label" htmlFor="to-units">To Units</label>
                        <select
                            id="to-units"
                            className="form-select"
                            value={graphConfig.toUnits}
                            onChange={(e) => updateGraphConfig({ toUnits: e.target.value, scaleFactor: MathUtils.dmtToUnitFactor(graphConfig.fromUnits || 'USD$/dmt', e.target.value) })}
                        >
                            <option value=""> Select a Unit ...</option>
                            <option value="USD$/dmt">USD$/dmt</option>
                            <option value="USD$/lbs">USD$/lbs</option>
                            <option value="USD$/oz">USD$/oz</option>
                        </select>
                    </div>
                )}
            </div >
        </div>

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
        xAxis2: PropTypes.string,
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
        showGuideLines: PropTypes.bool,
        showDataTable: PropTypes.bool,
        showStaticTable: PropTypes.bool,
        selectedXValue: PropTypes.number
    }).isRequired,
    updateGraphConfig: PropTypes.func.isRequired,
    updateGlobalSettings: PropTypes.func.isRequired
};

export default GraphConfiguration;
