import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useConfig, debugLog, MathUtils, detectTypeConflict, resolveTypeConflict, SymbolFactory, validateSecondaryAxisTypes, ScaleFactory } from '@siimpli/graph-it-core';

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
    const [advancedCollapsed, setAdvancedCollapsed] = useState(true);
    const [informativeFieldsCollapsed, setInformativeFieldsCollapsed] = useState(true);
    const [pdfLinkingCollapsed, setPdfLinkingCollapsed] = useState(true);
    const [draggedSeriesIndex, setDraggedSeriesIndex] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedSeriesIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
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
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

        if (sourceIndex !== targetIndex) {
            moveSeries(sourceIndex, targetIndex);

            setCollapsedSeries(prev => {
                const next = new Set();
                const wasSourceCollapsed = prev.has(sourceIndex);

                prev.forEach(oldIndex => {
                    if (oldIndex === sourceIndex) return;

                    let newIndex = oldIndex;
                    if (sourceIndex < targetIndex) {
                        if (oldIndex > sourceIndex && oldIndex <= targetIndex) newIndex--;
                    } else {
                        if (oldIndex >= targetIndex && oldIndex < sourceIndex) newIndex++;
                    }
                    next.add(newIndex);
                });

                if (wasSourceCollapsed) next.add(targetIndex);
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
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    useEffect(() => {
        const primarySeries = graphConfig.series.filter(s => s.axisAssignment !== 'secondary');
        const secondarySeries = graphConfig.series.filter(s => s.axisAssignment === 'secondary');

        const validation = validateSecondaryAxisTypes(secondarySeries);
        if (!validation.isValid) {
            setConflictWarning({ type: 'validation', message: validation.message });
            return;
        }

        const conflict = detectTypeConflict(primarySeries, secondarySeries);
        if (conflict?.hasConflict) {
            const { updatedSeries, changes } = resolveTypeConflict(graphConfig.series, conflict);

            if (changes.length > 0) {
                const changeMessage = changes.map(c =>
                    `Series ${c.seriesIndex + 1}: ${c.oldType} → ${c.newType}`
                ).join('; ');

                setConflictWarning({
                    type: 'conflict',
                    message: `Type conflict auto-resolved: ${changeMessage}`,
                    details: `Secondary axis uses ${conflict.secondaryType}, so primary axis cannot use this type.`
                });

                updateGraphConfig({ series: updatedSeries });
            }
        } else {
            setConflictWarning(null);
        }
    }, [graphConfig.series, updateGraphConfig]);

    const handleAxisAssignmentChange = (index, value) => {
        updateSeries(index, { axisAssignment: value });
    };

    const handleGraphTypeChange = (index, value) => {
        const updates = { graphType: value };
        if (value === 'histogram') updates.yAxis = '__frequency__';
        updateSeries(index, updates);
    };

    const hasSecondaryAxis = graphConfig.dualUnits || graphConfig.series.some(s => s.axisAssignment === 'secondary');

    const getStaticScale = (axisKey) => {
        const axisScale = graphConfig.staticScales?.[axisKey];
        return {
            enabled: axisScale?.enabled || false,
            min: axisScale?.min ?? '',
            max: axisScale?.max ?? '',
            step: axisScale?.step ?? ''
        };
    };

    const updateStaticScale = (axisKey, updates) => {
        const currentScale = getStaticScale(axisKey);
        updateGraphConfig({
            staticScales: {
                ...(graphConfig.staticScales || {}),
                [axisKey]: { ...currentScale, ...updates }
            }
        });
    };

    const parseNumericInput = (value) => {
        if (value === '') return '';
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : '';
    };

    const informativeFields = Array.isArray(graphConfig.informativeFields)
        ? [...new Set(graphConfig.informativeFields.filter(Boolean))]
        : [];

    const pdfLinking = {
        enabled: Boolean(graphConfig.pdfLinking?.enabled),
        folderPath: graphConfig.pdfLinking?.folderPath || '',
        nameField: graphConfig.pdfLinking?.nameField || '',
        fileType: graphConfig.pdfLinking?.fileType === 'json' ? 'json' : 'pdf'
    };

    const columnLabelById = new Map(columns.map(col => [col.uniqueId, `${col.name} (${col.file})`]));

    const updateInformativeFields = (fieldIds) => {
        const unique = [...new Set((fieldIds || []).filter(Boolean))];
        updateGraphConfig({ informativeFields: unique });
    };

    const updatePdfLinking = (updates) => {
        updateGraphConfig({ pdfLinking: { ...pdfLinking, ...updates } });
    };

    const handleSelectPdfFolder = async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({ directory: true, multiple: false, title: 'Select PDF Folder' });
            if (typeof selected === 'string' && selected.trim()) {
                updatePdfLinking({ folderPath: selected.trim() });
            }
        } catch (error) {
            debugLog('[GraphConfiguration] Failed to select PDF folder', error);
        }
    };

    const addInformativeField = () => {
        const next = columns.find(col => !informativeFields.includes(col.uniqueId));
        if (!next) return;
        updateInformativeFields([...informativeFields, next.uniqueId]);
    };

    const updateInformativeFieldAt = (index, newFieldId) => {
        const next = [...informativeFields];
        next[index] = newFieldId;
        updateInformativeFields(next);
    };

    const removeInformativeFieldAt = (index) => {
        updateInformativeFields(informativeFields.filter((_, idx) => idx !== index));
    };

    const selectAllInformativeFields = () => {
        updateInformativeFields(columns.map(col => col.uniqueId));
    };

    return (
        <div className="card-body">
            {conflictWarning && (
                <div className={`conflict-banner conflict-banner--${conflictWarning.type === 'conflict' ? 'warning' : 'error'}`}>
                    <strong>⚠ {conflictWarning.type === 'conflict' ? 'Auto-Resolved' : 'Validation Error'}:</strong>
                    <div className="conflict-banner__detail">{conflictWarning.message}</div>
                    {conflictWarning.details && (
                        <div className="conflict-banner__detail">{conflictWarning.details}</div>
                    )}
                </div>
            )}

            {/* ── Core Settings ────────────────────────────────────────── */}
            <div className="graph-settings">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" htmlFor="graph-title">Graph Title</label>
                    <input
                        id="graph-title"
                        type="text"
                        className="form-input"
                        placeholder="Auto-generated from selected columns if left empty"
                        value={graphConfig.title || ''}
                        onChange={(e) => updateGraphConfig({ title: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="x-axis-column">
                        X-Axis Column
                        <span className="required-mark">*</span>
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
                    <label className="form-label" htmlFor="x-axis-label">X-Axis Label</label>
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
                    <label className="form-label" htmlFor="y-axis-label">Primary Y-Axis Label</label>
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
                        <label className="form-label" htmlFor="y-axis-label-2">Secondary Y-Axis Label</label>
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
                    <label className="form-label checkbox-label" htmlFor="join-x-axis">
                        <input
                            id="join-x-axis"
                            type="checkbox"
                            checked={globalSettings.joinXAxis || false}
                            onChange={(e) => updateGlobalSettings({ joinXAxis: e.target.checked })}
                        />
                        <span>Join X-Axis</span>
                    </label>
                </div>

                {globalSettings.joinXAxis && (
                    <div className="form-group join-columns-panel" style={{ gridColumn: '1 / -1' }}>
                        <div className="form-label join-columns-panel__label">
                            Join Columns
                            <span className="form-hint" style={{ display: 'inline', marginLeft: 'var(--spacing-sm)', fontWeight: 'normal' }}>
                                Priority: Primary X → Join Col 1 → Join Col 2…
                            </span>
                        </div>

                        {(graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : [])).map((joinColId, index) => (
                            // eslint-disable-next-line react/no-array-index-key -- join columns have no stable IDs
                            <div key={index} className="join-column-row">
                                <select
                                    className="form-select"
                                    value={joinColId}
                                    onChange={(e) => {
                                        const newJoinColumns = [...(graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : []))];
                                        newJoinColumns[index] = e.target.value;
                                        updateGraphConfig({ joinColumns: newJoinColumns, xAxis2: newJoinColumns[0] });
                                    }}
                                >
                                    <option value="">Select a column to join...</option>
                                    {columns.map(col => (
                                        <option key={col.uniqueId} value={col.uniqueId}>
                                            {col.name} ({col.file})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={() => {
                                        const newJoinColumns = (graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : [])).filter((_, i) => i !== index);
                                        updateGraphConfig({ joinColumns: newJoinColumns, xAxis2: newJoinColumns[0] || '' });
                                    }}
                                    aria-label="Remove this join column"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            className="btn btn-sm btn-secondary btn-block"
                            onClick={() => {
                                const newJoinColumns = [...(graphConfig.joinColumns || (graphConfig.xAxis2 ? [graphConfig.xAxis2] : [])), ''];
                                updateGraphConfig({ joinColumns: newJoinColumns });
                            }}
                        >
                            + Add Column to Join
                        </button>
                    </div>
                )}

                {/* ── Series ───────────────────────────────────────────── */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <div className="series-section-header">
                        <h4>Data Series</h4>
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={addSeries}
                            title="Add a new data series"
                        >
                            + Add Series
                        </button>
                    </div>
                </div>

                {graphConfig.series.map((series, index) => (
                    // eslint-disable-next-line react/no-array-index-key -- series have no stable IDs; index is the intended key for drag-reorder
                    <div
                        key={index}
                        className="series-config"
                        style={{
                            gridColumn: '1 / -1',
                            opacity: draggedSeriesIndex === index ? 0.4 : 1,
                            border: draggedSeriesIndex === index ? '2px dashed var(--primary-color)' : undefined,
                        }}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="series-header">
                            <button
                                type="button"
                                className="series-header__toggle"
                                onClick={() => toggleSeriesCollapse(index)}
                                aria-expanded={!collapsedSeries.has(index)}
                            >
                                <span
                                    className="series-header__chevron"
                                    style={{ transform: collapsedSeries.has(index) ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                                    aria-hidden="true"
                                >▼</span>
                                <h5 className="series-header__title">
                                    Series {index + 1}{series.titleName ? ` (${series.titleName})` : ''}
                                </h5>
                            </button>
                            {graphConfig.series.length > 1 && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={(e) => { e.stopPropagation(); removeSeries(index); }}
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
                                            <span className="required-mark">*</span>
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
                                        <label className="form-label" htmlFor={`series-title-name-${index}`}>Name</label>
                                        <input
                                            id={`series-title-name-${index}`}
                                            className="form-input"
                                            placeholder="Optional"
                                            value={series.titleName}
                                            onChange={(e) => updateSeries(index, { titleName: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`series-axis-assignment-${index}`}>Axis</label>
                                        <select
                                            id={`series-axis-assignment-${index}`}
                                            className="form-select"
                                            value={series.axisAssignment || 'primary'}
                                            onChange={(e) => handleAxisAssignmentChange(index, e.target.value)}
                                        >
                                            <option value="primary">Primary (Left)</option>
                                            <option value="secondary">Secondary (Right)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor={`series-graph-type-${index}`}>Type</label>
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
                                        <label className="form-label" htmlFor={`series-color-${index}`}>Color</label>
                                        <div className="color-input-row">
                                            <input
                                                id={`series-color-${index}`}
                                                type="color"
                                                className="form-input form-input-color"
                                                value={ScaleFactory.resolveColor(series.color) || '#000000'}
                                                onChange={(e) => updateSeries(index, { color: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={series.color || ''}
                                                placeholder="Auto"
                                                list="color-names"
                                                onChange={(e) => updateSeries(index, { color: e.target.value })}
                                            />
                                        </div>
                                        <datalist id="color-names">
                                            {Object.keys(ScaleFactory.CUSTOM_COLOR_MAP).map(key => (
                                                <option key={key} value={key} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                {/* Type-specific options */}
                                {series.graphType === 'bar' && (
                                    <div className="type-options-panel">
                                        <label className="form-label checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={series.showConfidenceInterval || false}
                                                onChange={(e) => updateSeries(index, { showConfidenceInterval: e.target.checked })}
                                            />
                                            <span>Show 95% Confidence Interval</span>
                                        </label>
                                        {series.showConfidenceInterval && (
                                            <div className="form-group" style={{ marginTop: 'var(--spacing-sm)' }}>
                                                <label className="form-label" htmlFor={`series-ci-level-${index}`}>Confidence Level (%)</label>
                                                <input
                                                    id={`series-ci-level-${index}`}
                                                    type="number"
                                                    min="1"
                                                    max="99"
                                                    className="form-input"
                                                    value={series.confidenceLevel || 95}
                                                    onChange={(e) => {
                                                        const val = Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 95));
                                                        updateSeries(index, { confidenceLevel: val });
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {series.graphType === 'line' && (
                                    <div className="type-options-panel">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor={`series-curve-type-${index}`}>Curve</label>
                                                <select
                                                    id={`series-curve-type-${index}`}
                                                    className="form-select"
                                                    value={series.curveType || 'curveMonotoneX'}
                                                    onChange={(e) => updateSeries(index, { curveType: e.target.value })}
                                                >
                                                    <option value="curveLinear">Linear</option>
                                                    <option value="curveMonotoneX">Smooth (Monotone)</option>
                                                    <option value="curveStep">Step</option>
                                                    <option value="curveStepAfter">Step After</option>
                                                    <option value="curveStepBefore">Step Before</option>
                                                    <option value="curveBasis">Basis (Spline)</option>
                                                    <option value="curveNatural">Natural</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" htmlFor={`series-line-style-${index}`}>Style</label>
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
                                            <div className="form-group">
                                                <label className="form-label" htmlFor={`series-stroke-width-${index}`}>Stroke Width</label>
                                                <input
                                                    id={`series-stroke-width-${index}`}
                                                    className="form-input"
                                                    value={series.strokeWidth}
                                                    onChange={(e) => updateSeries(index, { strokeWidth: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 'var(--spacing-sm)' }}>
                                                <label className="form-label checkbox-label" style={{ marginBottom: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={series.showPoints || false}
                                                        onChange={(e) => updateSeries(index, { showPoints: e.target.checked })}
                                                    />
                                                    <span>Show Points</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(!series.graphType || series.graphType === 'scatter') && (
                                    <div className="type-options-panel">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor={`series-dot-size-${index}`}>Dot Size</label>
                                                <input
                                                    id={`series-dot-size-${index}`}
                                                    className="form-input"
                                                    value={series.strokeWidth}
                                                    onChange={(e) => updateSeries(index, { strokeWidth: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label checkbox-label" htmlFor={`series-filter-${index}`}>
                                                    <input
                                                        id={`series-filter-${index}`}
                                                        type="checkbox"
                                                        checked={series.filter}
                                                        onChange={(e) => updateSeries(index, { filter: e.target.checked })}
                                                    />
                                                    <span>Filter</span>
                                                </label>
                                            </div>
                                            {series.filter && (
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor={`series-filter-column-${index}`}>
                                                        Filter Column
                                                        <span className="required-mark">*</span>
                                                    </label>
                                                    <select
                                                        id={`series-filter-column-${index}`}
                                                        className="form-select"
                                                        value={series.filterColumn}
                                                        onChange={(e) => updateSeries(index, { filterColumn: e.target.value })}
                                                    >
                                                        <option value="">Select a column...</option>
                                                        {columns.map(col => (
                                                            <option key={col.uniqueId} value={col.uniqueId}>
                                                                {col.name} ({col.file})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="form-group">
                                                <label className="form-label" htmlFor={`series-filter-type-${index}`}>Filter Type</label>
                                                <select
                                                    id={`series-filter-type-${index}`}
                                                    className="form-select"
                                                    value={series.filterType}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'unique') {
                                                            const uniqueValues = SymbolFactory.getUniqueValues(data, series.filterColumn.split('::')[0]);
                                                            updateSeries(index, { filterType: e.target.value, uniqueValues, symbolMap: SymbolFactory.getSymbolMap(uniqueValues) });
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
                                                    <label className="form-label checkbox-label" style={{ marginTop: 'var(--spacing-xl)' }}>
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
                                    </div>
                                )}

                                {/* ── Colour Grading ────────────────────────────── */}
                                {series.graphType !== 'histogram' && (
                                    <div className="type-options-panel">
                                        <div className="form-row">
                                            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 'var(--spacing-sm)' }}>
                                                <label className="form-label checkbox-label" style={{ marginBottom: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={series.colorGrading?.enabled || false}
                                                        onChange={(e) => updateSeries(index, {
                                                            colorGrading: { ...series.colorGrading, enabled: e.target.checked }
                                                        })}
                                                    />
                                                    <span>Colour Grading</span>
                                                </label>
                                            </div>
                                            {series.colorGrading?.enabled && (
                                                <>
                                                    <div className="form-group">
                                                        <label className="form-label" htmlFor={`series-grading-col-${index}`}>Grading Column</label>
                                                        <select
                                                            id={`series-grading-col-${index}`}
                                                            className="form-select"
                                                            value={series.colorGrading?.column || ''}
                                                            onChange={(e) => updateSeries(index, {
                                                                colorGrading: { ...series.colorGrading, column: e.target.value, categoryColors: {} }
                                                            })}
                                                        >
                                                            <option value="">Select a column...</option>
                                                            {columns.map(col => (
                                                                <option key={col.uniqueId} value={col.uniqueId}>
                                                                    {col.name} ({col.file})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label" htmlFor={`series-grading-mode-${index}`}>Mode</label>
                                                        <select
                                                            id={`series-grading-mode-${index}`}
                                                            className="form-select"
                                                            value={series.colorGrading?.mode || 'continuous'}
                                                            onChange={(e) => updateSeries(index, {
                                                                colorGrading: { ...series.colorGrading, mode: e.target.value }
                                                            })}
                                                        >
                                                            <option value="continuous">Continuous</option>
                                                            <option value="distinct">Distinct</option>
                                                        </select>
                                                    </div>
                                                    {(series.colorGrading?.mode || 'continuous') === 'continuous' && (
                                                        <div className="form-group">
                                                            <label className="form-label" htmlFor={`series-grading-scheme-${index}`}>Colour Scheme</label>
                                                            <select
                                                                id={`series-grading-scheme-${index}`}
                                                                className="form-select"
                                                                value={series.colorGrading?.scheme || 'warm-cool'}
                                                                onChange={(e) => updateSeries(index, {
                                                                    colorGrading: { ...series.colorGrading, scheme: e.target.value }
                                                                })}
                                                            >
                                                                <option value="warm-cool">Warm to Cool</option>
                                                                <option value="green-red">Green to Red</option>
                                                                <option value="rainbow">Rainbow Spectrum</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {series.colorGrading?.enabled &&
                                            (series.colorGrading?.mode || 'continuous') === 'distinct' &&
                                            series.colorGrading?.column && (() => {
                                                const colId = series.colorGrading.column;
                                                const colName = colId.split('::')[0];
                                                const uniqueVals = SymbolFactory.getUniqueValues(data, colName);
                                                const catColors = series.colorGrading?.categoryColors || {};
                                                const d3Colors = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
                                                return uniqueVals.length > 0 ? (
                                                    <div style={{ marginTop: 'var(--spacing-sm)' }}>
                                                        <span className="form-label">Category Colours</span>
                                                        <div style={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 'var(--spacing-xs)',
                                                            maxHeight: '120px',
                                                            overflowY: 'auto',
                                                            padding: 'var(--spacing-xs)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 'var(--border-radius)',
                                                            background: 'var(--background-color)'
                                                        }}>
                                                            {uniqueVals.map((val, vi) => {
                                                                const currentColor = catColors[val] || d3Colors[vi % d3Colors.length];
                                                                return (
                                                                    <label
                                                                        key={val}
                                                                        title={`${val}: click swatch to change colour`}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '2px 8px 2px 4px',
                                                                            border: '1px solid var(--border-color)',
                                                                            borderRadius: '999px',
                                                                            background: 'var(--surface-color)',
                                                                            fontSize: '0.78rem',
                                                                            cursor: 'pointer',
                                                                            userSelect: 'none'
                                                                        }}
                                                                    >
                                                                        <input
                                                                            type="color"
                                                                            value={currentColor}
                                                                            onChange={(e) => updateSeries(index, {
                                                                                colorGrading: {
                                                                                    ...series.colorGrading,
                                                                                    categoryColors: { ...catColors, [val]: e.target.value }
                                                                                }
                                                                            })}
                                                                            style={{ width: '18px', height: '18px', padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'none' }}
                                                                        />
                                                                        <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(val)}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()
                                        }
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Global type-dependent fields */}
                {graphConfig.series.some(s => s.graphType === 'histogram') && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label" htmlFor="histogram-num-bins">Number of Bins</label>
                        <input
                            id="histogram-num-bins"
                            type="number"
                            min="1"
                            step="1"
                            className="form-input"
                            placeholder="Auto (Freedman–Diaconis)"
                            value={graphConfig.numBins || ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Math.max(1, Math.round(Number(e.target.value)));
                                updateGraphConfig({ numBins: val });
                            }}
                        />
                    </div>
                )}

                {graphConfig.series.some(s => s.graphType === 'bar') && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label" htmlFor="bar-type">Bar Layout</label>
                        <select
                            id="bar-type"
                            className="form-select"
                            value={globalSettings.barType}
                            onChange={(e) => updateGraphConfig({ barMode: e.target.value })}
                        >
                            <option value="group">Grouped</option>
                            <option value="stack">Stacked</option>
                            <option value="stack-proportional">Stacked Proportional</option>
                        </select>
                    </div>
                )}

                {/* ── Advanced ─────────────────────────────────────────── */}
                <div className="section-divider" style={{ gridColumn: '1 / -1' }}>
                    <button
                        type="button"
                        className="section-toggle"
                        onClick={() => setAdvancedCollapsed(c => !c)}
                        aria-expanded={!advancedCollapsed}
                    >
                        <span
                            className="section-toggle__chevron"
                            style={{ transform: advancedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                            aria-hidden="true"
                        >▼</span>
                        Advanced
                    </button>

                    {!advancedCollapsed && (
                        <div style={{ paddingBottom: 'var(--spacing-md)' }}>
                            {/* Graph Scaling */}
                            <h5 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Graph Scaling
                            </h5>
                            <div className="form-row" style={{ marginBottom: 'var(--spacing-lg)' }}>
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

                            {/* Static Axis Scales */}
                            <h5 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Static Axis Scales
                            </h5>
                            <p className="form-hint" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                Fix numeric min/max/step per axis.
                            </p>
                            {[
                                { key: 'x', label: 'X Axis' },
                                { key: 'y', label: 'Primary Y Axis' },
                                ...(hasSecondaryAxis ? [{ key: 'y2', label: 'Secondary Y Axis' }] : [])
                            ].map(axis => {
                                const axisScale = getStaticScale(axis.key);
                                return (
                                    <div key={axis.key} className="axis-scale-row">
                                        <label className="form-label checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={axisScale.enabled}
                                                onChange={(e) => updateStaticScale(axis.key, { enabled: e.target.checked })}
                                            />
                                            <span>{axis.label}</span>
                                        </label>
                                        {axisScale.enabled && (
                                            <div className="form-row" style={{ marginTop: 'var(--spacing-sm)' }}>
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor={`static-scale-${axis.key}-min`}>Minimum</label>
                                                    <input
                                                        id={`static-scale-${axis.key}-min`}
                                                        type="number"
                                                        step="any"
                                                        className="form-input"
                                                        value={axisScale.min}
                                                        onChange={(e) => updateStaticScale(axis.key, { min: parseNumericInput(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor={`static-scale-${axis.key}-max`}>Maximum</label>
                                                    <input
                                                        id={`static-scale-${axis.key}-max`}
                                                        type="number"
                                                        step="any"
                                                        className="form-input"
                                                        value={axisScale.max}
                                                        onChange={(e) => updateStaticScale(axis.key, { max: parseNumericInput(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor={`static-scale-${axis.key}-step`}>Step</label>
                                                    <input
                                                        id={`static-scale-${axis.key}-step`}
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        className="form-input"
                                                        value={axisScale.step}
                                                        onChange={(e) => updateStaticScale(axis.key, { step: parseNumericInput(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Axis Intercepts */}
                            <h5 style={{ margin: 'var(--spacing-lg) 0 var(--spacing-sm) 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Axis Intercepts
                            </h5>
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
                                {graphConfig.axisIntercept === 'custom' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="custom-intercept-x">X Coordinate</label>
                                            <input
                                                id="custom-intercept-x"
                                                type="number"
                                                className="form-input"
                                                placeholder="0"
                                                value={graphConfig.customIntercept?.x ?? 0}
                                                onChange={(e) => updateGraphConfig({
                                                    customIntercept: { ...graphConfig.customIntercept, x: Number.parseFloat(e.target.value) }
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
                                                    customIntercept: { ...graphConfig.customIntercept, y: Number.parseFloat(e.target.value) }
                                                })}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Transformations */}
                            <h5 style={{ margin: 'var(--spacing-lg) 0 var(--spacing-sm) 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Transformations
                            </h5>
                            <p className="form-hint" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                Apply axis transforms to explore data distributions (e.g. log-normal).
                            </p>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label checkbox-label" htmlFor="log-x">
                                        <input
                                            id="log-x"
                                            type="checkbox"
                                            checked={graphConfig.logX || false}
                                            onChange={(e) => updateGraphConfig({ logX: e.target.checked })}
                                        />
                                        <span>Log X Axis</span>
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label className="form-label checkbox-label" htmlFor="log-y">
                                        <input
                                            id="log-y"
                                            type="checkbox"
                                            checked={graphConfig.logY || false}
                                            onChange={(e) => updateGraphConfig({ logY: e.target.checked })}
                                        />
                                        <span>Log Y Axis</span>
                                    </label>
                                </div>
                            </div>
                            {(graphConfig.logX || graphConfig.logY) && (
                                <p className="form-hint form-hint--warning">
                                    ⚠ Log scale requires all values to be positive. Zero and negative values will be excluded.
                                </p>
                            )}

                            {/* Display Options */}
                            <h5 style={{ margin: 'var(--spacing-lg) 0 var(--spacing-sm) 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Display Options
                            </h5>
                            <div className="form-group">
                                <label className="form-label checkbox-label" htmlFor="show-guide-lines">
                                    <input
                                        id="show-guide-lines"
                                        type="checkbox"
                                        checked={globalSettings.showGuideLines || false}
                                        onChange={(e) => updateGlobalSettings({ showGuideLines: e.target.checked })}
                                    />
                                    <span>Show Guide Lines</span>
                                </label>
                            </div>

                            <div className="form-group">
                                <label className="form-label checkbox-label" htmlFor="show-data-table">
                                    <input
                                        id="show-data-table"
                                        type="checkbox"
                                        checked={globalSettings.showDataTable || false}
                                        onChange={(e) => updateGlobalSettings({ showDataTable: e.target.checked })}
                                    />
                                    <span>Show Data Table</span>
                                </label>
                                <p className="form-hint form-hint--indented">Display values at cursor position.</p>
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <label className="form-label checkbox-label" htmlFor="show-static-table" style={{ marginBottom: 0 }}>
                                        <input
                                            id="show-static-table"
                                            type="checkbox"
                                            checked={globalSettings.showStaticTable || false}
                                            onChange={(e) => updateGlobalSettings({ showStaticTable: e.target.checked })}
                                        />
                                        <span>Show Static Table</span>
                                    </label>
                                    {globalSettings.showStaticTable && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <label className="form-label" htmlFor="selected-x-value" style={{ marginBottom: 0 }}>X Value:</label>
                                            <input
                                                id="selected-x-value"
                                                type="number"
                                                step="any"
                                                className="form-input"
                                                style={{ width: '100px', padding: '2px var(--spacing-sm)' }}
                                                value={globalSettings.selectedXValue !== null ? globalSettings.selectedXValue : ''}
                                                onChange={(e) => updateGraphConfig({ selectedXValue: e.target.value === '' ? null : parseFloat(e.target.value) })}
                                                placeholder="Click graph"
                                            />
                                        </div>
                                    )}
                                </div>
                                <p className="form-hint form-hint--indented">Persistent table below legend. Click graph or enter value to update.</p>

                                {globalSettings.showStaticTable && (
                                    <label className="form-label checkbox-label" htmlFor="show-unified-table" style={{ marginTop: 'var(--spacing-sm)', marginLeft: '24px' }}>
                                        <input
                                            id="show-unified-table"
                                            type="checkbox"
                                            checked={globalSettings.showUnifiedTable || false}
                                            onChange={(e) => updateGlobalSettings({ showUnifiedTable: e.target.checked })}
                                        />
                                        <span>Unified Table (Legend + Values)</span>
                                    </label>
                                )}

                                {globalSettings.showStaticTable && globalSettings.showUnifiedTable && (
                                    <div style={{ marginTop: 'var(--spacing-sm)', marginLeft: '24px' }}>
                                        <label className="form-label checkbox-label" htmlFor="show-bias-table">
                                            <input
                                                id="show-bias-table"
                                                type="checkbox"
                                                checked={globalSettings.showBiasTable || false}
                                                onChange={(e) => updateGlobalSettings({ showBiasTable: e.target.checked })}
                                            />
                                            <span>Show Bias Table</span>
                                        </label>

                                        {globalSettings.showBiasTable && (
                                            <div style={{ marginTop: 'var(--spacing-sm)', marginLeft: '24px' }}>
                                                <label className="form-label" htmlFor="bias-table-file" style={{ marginBottom: 'var(--spacing-xs)', display: 'block' }}>
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
                                                    style={{ padding: 'var(--spacing-sm)' }}
                                                />
                                                {globalSettings.biasTableFile && (
                                                    <p className="form-hint">Loaded: {globalSettings.biasTableFile}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Dual Units */}
                            <h5 style={{ margin: 'var(--spacing-lg) 0 var(--spacing-sm) 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Unit Conversion
                            </h5>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label checkbox-label" htmlFor="dual-units">
                                        <input
                                            id="dual-units"
                                            type="checkbox"
                                            checked={graphConfig.dualUnits}
                                            onChange={(e) => updateGraphConfig({ dualUnits: e.target.checked, scaleFactor: MathUtils.dmtToUnitFactor(globalSettings.fromUnits || 'USD$/dmt') })}
                                        />
                                        <span>Dual Units</span>
                                    </label>
                                </div>
                                {graphConfig.dualUnits && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="from-units">From</label>
                                            <select
                                                id="from-units"
                                                className="form-select"
                                                value={graphConfig.fromUnits}
                                                onChange={(e) => updateGraphConfig({ fromUnits: e.target.value, scaleFactor: MathUtils.dmtToUnitFactor(e.target.value, graphConfig.toUnits || 'USD$/dmt') })}
                                            >
                                                <option value="">Select unit...</option>
                                                <option value="USD$/dmt">USD$/dmt</option>
                                                <option value="USD$/lbs">USD$/lbs</option>
                                                <option value="USD$/oz">USD$/oz</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="to-units">To</label>
                                            <select
                                                id="to-units"
                                                className="form-select"
                                                value={graphConfig.toUnits}
                                                onChange={(e) => updateGraphConfig({ toUnits: e.target.value, scaleFactor: MathUtils.dmtToUnitFactor(graphConfig.fromUnits || 'USD$/dmt', e.target.value) })}
                                            >
                                                <option value="">Select unit...</option>
                                                <option value="USD$/dmt">USD$/dmt</option>
                                                <option value="USD$/lbs">USD$/lbs</option>
                                                <option value="USD$/oz">USD$/oz</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Informative Fields ───────────────────────────────────── */}
            <div className="section-divider">
                <button
                    type="button"
                    className="section-toggle"
                    onClick={() => setInformativeFieldsCollapsed(c => !c)}
                    aria-expanded={!informativeFieldsCollapsed}
                >
                    <span
                        className="section-toggle__chevron"
                        style={{ transform: informativeFieldsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        aria-hidden="true"
                    >▼</span>
                    Informative Fields
                </button>

                {!informativeFieldsCollapsed && (
                    <div style={{ paddingBottom: 'var(--spacing-md)' }}>
                        <p className="form-hint" style={{ marginBottom: 'var(--spacing-sm)' }}>
                            Attach non-series CSV columns to plotted points for downstream interactions.
                        </p>

                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={addInformativeField}
                                disabled={informativeFields.length >= columns.length}
                            >
                                + Add Field
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={selectAllInformativeFields}
                                disabled={columns.length === 0 || informativeFields.length === columns.length}
                            >
                                Select All
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => updateInformativeFields([])}
                                disabled={informativeFields.length === 0}
                            >
                                Clear
                            </button>
                        </div>

                        {informativeFields.length === 0 ? (
                            <p className="form-hint">No informative fields selected.</p>
                        ) : (
                            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                {informativeFields.map((fieldId, index) => {
                                    const optionsForRow = columns.filter(col => col.uniqueId === fieldId || !informativeFields.includes(col.uniqueId));
                                    return (
                                        <div key={fieldId} className="form-row" style={{ alignItems: 'flex-end' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" htmlFor={`informative-field-${index}`}>
                                                    Field {index + 1}
                                                </label>
                                                <select
                                                    id={`informative-field-${index}`}
                                                    className="form-select"
                                                    value={fieldId}
                                                    onChange={(e) => updateInformativeFieldAt(index, e.target.value)}
                                                >
                                                    {optionsForRow.map(col => (
                                                        <option key={col.uniqueId} value={col.uniqueId}>
                                                            {col.name} ({col.file})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-danger"
                                                onClick={() => removeInformativeFieldAt(index)}
                                                title="Remove field"
                                                style={{ alignSelf: 'end' }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {informativeFields.length > 0 && (
                            <p className="form-hint" style={{ marginTop: 'var(--spacing-sm)' }}>
                                Selected: {informativeFields.map(id => columnLabelById.get(id) || id).join(', ')}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ── PDF Linking ──────────────────────────────────────────── */}
            <div className="section-divider">
                <button
                    type="button"
                    className="section-toggle"
                    onClick={() => setPdfLinkingCollapsed(c => !c)}
                    aria-expanded={!pdfLinkingCollapsed}
                >
                    <span
                        className="section-toggle__chevron"
                        style={{ transform: pdfLinkingCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        aria-hidden="true"
                    >▼</span>
                    PDF Linking
                </button>

                {!pdfLinkingCollapsed && (
                    <div style={{ paddingBottom: 'var(--spacing-md)' }}>
                        <p className="form-hint" style={{ marginBottom: 'var(--spacing-sm)' }}>
                            Click a plotted point to open a matching file. The selected field value becomes the filename (without extension).
                        </p>

                        <div className="form-group">
                            <label className="form-label checkbox-label" htmlFor="enable-pdf-linking">
                                <input
                                    id="enable-pdf-linking"
                                    type="checkbox"
                                    checked={pdfLinking.enabled}
                                    onChange={(e) => updatePdfLinking({ enabled: e.target.checked })}
                                />
                                <span>Enable point click to open file</span>
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="pdf-folder-path">Folder</label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                                <input
                                    id="pdf-folder-path"
                                    type="text"
                                    className="form-input"
                                    placeholder="C:\Reports\PDF"
                                    value={pdfLinking.folderPath}
                                    onChange={(e) => updatePdfLinking({ folderPath: e.target.value })}
                                    style={{ flex: 1 }}
                                />
                                <button type="button" className="btn btn-secondary" onClick={handleSelectPdfFolder}>
                                    Browse
                                </button>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="pdf-file-type">File Type</label>
                                <select
                                    id="pdf-file-type"
                                    className="form-select"
                                    value={pdfLinking.fileType}
                                    onChange={(e) => updatePdfLinking({ fileType: e.target.value === 'json' ? 'json' : 'pdf' })}
                                >
                                    <option value="pdf">PDF</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="pdf-name-field">Name Field</label>
                                <select
                                    id="pdf-name-field"
                                    className="form-select"
                                    value={pdfLinking.nameField}
                                    onChange={(e) => updatePdfLinking({ nameField: e.target.value })}
                                >
                                    <option value="">Select field for filename...</option>
                                    {columns.map(col => (
                                        <option key={col.uniqueId} value={col.uniqueId}>
                                            {col.name} ({col.file})
                                        </option>
                                    ))}
                                </select>
                                <p className="form-hint">
                                    e.g. value "report_123" → report_123.{pdfLinking.fileType}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
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
        informativeFields: PropTypes.arrayOf(PropTypes.string),
        pdfLinking: PropTypes.shape({
            enabled: PropTypes.bool,
            folderPath: PropTypes.string,
            nameField: PropTypes.string,
            fileType: PropTypes.oneOf(['pdf', 'json'])
        }),
        series: PropTypes.arrayOf(PropTypes.shape({
            yAxis: PropTypes.string,
            axisAssignment: PropTypes.string,
            graphType: PropTypes.string
        })).isRequired,
        barMode: PropTypes.string,
        colorGrading: PropTypes.string,
        contouring: PropTypes.string,
        axisIntercept: PropTypes.string,
        staticScales: PropTypes.shape({
            x: PropTypes.shape({
                enabled: PropTypes.bool,
                min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
                max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
                step: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
            }),
            y: PropTypes.shape({
                enabled: PropTypes.bool,
                min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
                max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
                step: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
            }),
            y2: PropTypes.shape({
                enabled: PropTypes.bool,
                min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
                max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
                step: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
            })
        }),
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
