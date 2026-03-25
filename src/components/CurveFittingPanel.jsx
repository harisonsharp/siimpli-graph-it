import { Minus, Plus } from 'lucide-react';
import React from 'react';

/**
 * @fileoverview Interactive UI panel for configuring and controlling mathematical curve fitting operations.
 * Provides form controls for polynomial order, fit ranges, custom equations, confidence bands,
 * and curve management with real-time parameter adjustment.
 *
 * @author Harison Sharp
 * @since 0.2.0
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library for component creation
 * @requires lucide-react - Icon components for add/remove buttons (Plus, Minus)
 *
 * @param {Object} props - Component props
 * @param {Array} props.curveFits - Array of curve fit configurations
 * @param {Object} props.dataRange - Min/max values for x-axis range validation
 * @param {Function} props.onPerformFitting - Callback to execute curve fitting calculations
 * @param {Function} props.updateCurveFit - Function to update individual curve parameters
 * @param {Function} props.addCurveFit - Function to add new curve fit configuration
 * @param {Function} props.removeCurveFit - Function to remove curve fit configuration
 * @param {Array} props.seriesInfo - Array of available data series for curve fitting
 *
 * @exports default CurveFittingPanel
 */

// ---------------------------------------------------------------------------
// Confidence band sub-component
// ---------------------------------------------------------------------------

const DEFAULT_BAND = { mode: 'stddev', nStdDev: 1, nBins: 8, upperExpr: '', lowerExpr: '', color: '' };

const ConfidenceBandRow = ({ band, bandIdx, curveColor, onChange, onRemove }) => {
    const color = band.color || curveColor;
    const modeId = `band-mode-${bandIdx}`;
    const nStdId = `band-nstd-${bandIdx}`;
    const upperExprId = `band-upper-${bandIdx}`;
    const lowerExprId = `band-lower-${bandIdx}`;

    return (
        <div style={{
            display: 'grid',
            gap: '6px',
            padding: '8px',
            background: 'var(--bg-secondary, #f5f5f5)',
            borderRadius: 'var(--border-radius-sm)',
            borderLeft: `3px solid ${color}`
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Band {bandIdx + 1}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                        type="color"
                        value={color}
                        onChange={e => onChange('color', e.target.value)}
                        style={{ width: '28px', height: '24px', padding: '1px', cursor: 'pointer', border: '1px solid var(--border-color)', borderRadius: '3px' }}
                        title="Band colour"
                        aria-label={`Band ${bandIdx + 1} colour`}
                    />
                    <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={onRemove}
                        title="Remove this band"
                        style={{ padding: '2px 6px' }}
                    >
                        <Minus size={12} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <label htmlFor={modeId} style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '36px' }}>Mode</label>
                <select
                    id={modeId}
                    value={band.mode}
                    onChange={e => onChange('mode', e.target.value)}
                    className="form-select"
                    style={{ fontSize: '13px', flex: 1 }}
                >
                    <option value="stddev">Std Dev from residuals (global)</option>
                    <option value="local_stddev">Local Std Dev (tapers with data)</option>
                    <option value="expression">Custom expressions</option>
                </select>
            </div>

            {(band.mode === 'stddev' || band.mode === 'local_stddev') && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <label htmlFor={nStdId} style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '36px' }}>N std</label>
                    <input
                        id={nStdId}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={band.nStdDev ?? 1}
                        onChange={e => onChange('nStdDev', parseFloat(e.target.value))}
                        className="form-input"
                        style={{ fontSize: '13px', flex: 1 }}
                        placeholder="1"
                        title="Number of standard deviations"
                    />
                </div>
            )}

            {band.mode === 'local_stddev' && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <label htmlFor={`band-nbins-${bandIdx}`} style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '36px' }}>Bins</label>
                    <input
                        id={`band-nbins-${bandIdx}`}
                        type="number"
                        min="2"
                        max="30"
                        step="1"
                        value={band.nBins ?? 8}
                        onChange={e => onChange('nBins', parseInt(e.target.value, 10))}
                        className="form-input"
                        style={{ fontSize: '13px', flex: 1 }}
                        placeholder="8"
                        title="Number of x-quantile bins for local std estimation — more bins = finer detail, fewer bins = smoother"
                    />
                </div>
            )}

            {band.mode === 'expression' && (
                <>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <label htmlFor={upperExprId} style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '36px' }}>Upper</label>
                        <input
                            id={upperExprId}
                            type="text"
                            value={band.upperExpr ?? ''}
                            onChange={e => onChange('upperExpr', e.target.value)}
                            className="form-input"
                            style={{ fontSize: '13px', flex: 1, fontFamily: 'monospace' }}
                            placeholder="e.g. y * 1.235"
                            title="Upper band expression — use 'y' for the curve value, 'x' for x"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <label htmlFor={lowerExprId} style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '36px' }}>Lower</label>
                        <input
                            id={lowerExprId}
                            type="text"
                            value={band.lowerExpr ?? ''}
                            onChange={e => onChange('lowerExpr', e.target.value)}
                            className="form-input"
                            style={{ fontSize: '13px', flex: 1, fontFamily: 'monospace' }}
                            placeholder="e.g. y * 0.793"
                            title="Lower band expression — use 'y' for the curve value, 'x' for x"
                        />
                    </div>
                </>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Result display including band statistics
// ---------------------------------------------------------------------------

const CurveResult = ({ result, index }) => {
    if (!result) return null;

    return (
        <div style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            background: 'var(--success-color)',
            color: 'white',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: '14px',
            fontFamily: 'monospace'
        }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                Curve {index + 1} Result:
            </div>
            <div>{result.equation}</div>
            <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                R² = {result.rSquared.toFixed(4)} (Goodness of fit)
            </div>
            {result.confidenceBands?.map((band, bi) => {
                if (!band) return null;
                const hasStdPct = band.upperStdPct != null && band.lowerStdPct != null;
                return (
                    <div key={`band-result-${band.upperStdPct ?? bi}-${band.lowerStdPct ?? 0}`} style={{ marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>
                        Band {bi + 1}:{' '}
                        {hasStdPct
                            ? `Upper σ = ${band.upperStdPct.toFixed(1)}%  |  Lower σ = ${band.lowerStdPct.toFixed(1)}%`
                            : `${band.upperBandPoints?.length ?? 0} upper pts, ${band.lowerBandPoints?.length ?? 0} lower pts`
                        }
                    </div>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

const CurveFittingPanel = ({
    curveFits,
    dataRange,
    onPerformFitting,
    updateCurveFit,
    addCurveFit,
    removeCurveFit,
    seriesInfo = []
}) => {
    const updateBands = (fitIndex, curveFit, updater) => {
        const prev = curveFit.confidenceBands ?? { enabled: false, bands: [] };
        updateCurveFit(fitIndex, 'confidenceBands', updater(prev));
    };

    const addBand = (fitIndex, curveFit) => {
        updateBands(fitIndex, curveFit, prev => ({
            ...prev,
            bands: [...prev.bands, { ...DEFAULT_BAND, color: curveFit.color }]
        }));
    };

    const removeBand = (fitIndex, curveFit, bandIdx) => {
        updateBands(fitIndex, curveFit, prev => ({
            ...prev,
            bands: prev.bands.filter((_, i) => i !== bandIdx)
        }));
    };

    const updateBand = (fitIndex, curveFit, bandIdx, field, value) => {
        updateBands(fitIndex, curveFit, prev => ({
            ...prev,
            bands: prev.bands.map((b, i) => i === bandIdx ? { ...b, [field]: value } : b)
        }));
    };

    return (
        <div className="curve-fitting-panel">
            <div className="curve-fitting-header">
                <div>
                    <h3 className="curve-fitting-title">Advanced Curve Fitting</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        Fit mathematical curves to your data with customizable parameters
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={onPerformFitting}
                        title="Calculate curve fits for all enabled curves"
                    >
                        Fit Curves
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={addCurveFit}
                        title="Add a new curve configuration"
                    >
                        <Plus size={16} />
                        Add Curve
                    </button>
                    {curveFits.length > 1 && (
                        <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={removeCurveFit}
                            title="Remove the last curve configuration"
                        >
                            <Minus size={16} />
                            Remove
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {curveFits.map((curveFit, index) => {
                    const bands = curveFit.confidenceBands ?? { enabled: false, bands: [] };
                    const fitKey = `curve-${index}-${curveFit.fitType}`;

                    return (
                        <div key={fitKey} className="curve-fit-item">
                            <div className="curve-fit-controls">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={curveFit.enabled}
                                        onChange={(e) => updateCurveFit(index, 'enabled', e.target.checked)}
                                        className="form-checkbox"
                                    />
                                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Enable</span>
                                </label>

                                <div
                                    className="curve-fit-color-indicator"
                                    style={{ backgroundColor: curveFit.color }}
                                    title={`Curve ${index + 1} color`}
                                />

                                {seriesInfo.length > 0 && (
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <select
                                            value={curveFit.seriesIndex ?? 0}
                                            onChange={(e) => updateCurveFit(index, 'seriesIndex', parseInt(e.target.value, 10))}
                                            className="form-select"
                                            style={{ fontSize: '14px' }}
                                            title="Select which data series to fit"
                                            aria-label={`Curve ${index + 1} series`}
                                        >
                                            {seriesInfo.map((series, idx) => (
                                                <option key={series.yAxisInfo?.columnName ?? `series-${idx}`} value={idx}>
                                                    Series {idx + 1}: {series.yAxisInfo?.columnName || 'Unnamed'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="form-group" style={{ margin: 0 }}>
                                    <select
                                        value={curveFit.fitType}
                                        onChange={(e) => updateCurveFit(index, 'fitType', e.target.value)}
                                        className="form-select"
                                        style={{ fontSize: '14px' }}
                                        aria-label={`Curve ${index + 1} fit type`}
                                    >
                                        <option value="polynomial">Polynomial Fit</option>
                                        <option value="power_law">Power Law Fit</option>
                                        <option value="best_fit">Best Fit Auto</option>
                                        <option value="custom">Custom Equation</option>
                                    </select>
                                </div>

                                {curveFit.fitType === 'polynomial' && (
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <input
                                            type="number"
                                            min="1"
                                            max="6"
                                            value={curveFit.order}
                                            onChange={(e) => updateCurveFit(index, 'order', parseInt(e.target.value, 10))}
                                            className="form-input"
                                            placeholder="Polynomial Order"
                                            title="Polynomial order (1-6)"
                                            aria-label={`Curve ${index + 1} polynomial order`}
                                            style={{ fontSize: '14px' }}
                                        />
                                    </div>
                                )}

                                <div className="form-group" style={{ margin: 0 }}>
                                    <input
                                        type="number"
                                        step="any"
                                        value={curveFit.xMin}
                                        onChange={(e) => updateCurveFit(index, 'xMin', e.target.value)}
                                        placeholder={`Min X (${dataRange.min.toFixed(2)})`}
                                        className="form-input"
                                        title="Minimum X value — leave blank to use data minimum"
                                        aria-label={`Curve ${index + 1} minimum X`}
                                        style={{ fontSize: '14px' }}
                                    />
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                    <input
                                        type="number"
                                        step="any"
                                        value={curveFit.xMax}
                                        onChange={(e) => updateCurveFit(index, 'xMax', e.target.value)}
                                        placeholder={`Max X (${dataRange.max.toFixed(2)})`}
                                        className="form-input"
                                        title="Maximum X value — leave blank to use data maximum"
                                        aria-label={`Curve ${index + 1} maximum X`}
                                        style={{ fontSize: '14px' }}
                                    />
                                </div>
                            </div>

                            {/* Custom equation input */}
                            {curveFit.fitType === 'custom' && (
                                <div style={{ marginTop: '8px' }}>
                                    <input
                                        type="text"
                                        value={curveFit.customEquation ?? ''}
                                        onChange={(e) => updateCurveFit(index, 'customEquation', e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. 30.65 * x^(0.2286)"
                                        title="Enter your equation using x as the variable. Supports +, -, *, /, ^ and parentheses."
                                        aria-label={`Curve ${index + 1} custom equation`}
                                        style={{ fontSize: '14px', fontFamily: 'monospace', width: '100%' }}
                                    />
                                    <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        Use <code>x</code> as the variable. Operators: <code>+ - * / ^</code> and parentheses.
                                        R² is computed against the selected series.
                                    </p>
                                </div>
                            )}

                            {/* Confidence bands section */}
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                            type="checkbox"
                                            checked={bands.enabled}
                                            onChange={(e) => updateBands(index, curveFit, prev => ({ ...prev, enabled: e.target.checked }))}
                                            className="form-checkbox"
                                        />
                                        <span style={{ fontWeight: '500' }}>Confidence Bands</span>
                                    </label>
                                    {bands.enabled && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => addBand(index, curveFit)}
                                            title="Add a confidence band"
                                            style={{ padding: '2px 8px', fontSize: '12px' }}
                                        >
                                            <Plus size={12} /> Add Band
                                        </button>
                                    )}
                                </div>

                                {bands.enabled && bands.bands.length > 0 && (
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                        {bands.bands.map((band, bandIdx) => (
                                            <ConfidenceBandRow
                                                key={`${fitKey}-band-${band.mode}-${band.upperExpr ?? ''}-${band.lowerExpr ?? ''}`}
                                                band={band}
                                                bandIdx={bandIdx}
                                                curveColor={curveFit.color}
                                                onChange={(field, value) => updateBand(index, curveFit, bandIdx, field, value)}
                                                onRemove={() => removeBand(index, curveFit, bandIdx)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <CurveResult result={curveFit.result} index={index} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CurveFittingPanel;
