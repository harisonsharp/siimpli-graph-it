import { Minus, Plus } from 'lucide-react';
import React from 'react';
import {ScaleFactory} from'@harisonsharp/graph-it-core';
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
 * @param {Object} props.graphConfig - Graph configuration containing configured series
 *
 * @exports default CurveFittingPanel
 */

// ---------------------------------------------------------------------------
// Confidence band sub-component
// ---------------------------------------------------------------------------

const DEFAULT_BAND = { mode: 'stddev', nStdDev: 1, nBins: 8, smoothing: 0.15, upperExpr: '', lowerExpr: '', color: '' };

const ConfidenceBandRow = ({ band, bandIdx, curveColor, onChange, onRemove }) => {
    const color = band.color || curveColor;
    const modeId = `band-mode-${bandIdx}`;
    const nStdId = `band-nstd-${bandIdx}`;
    const upperExprId = `band-upper-${bandIdx}`;
    const lowerExprId = `band-lower-${bandIdx}`;

    return (
        <div className="curve-fit-band-row" style={{ borderLeft: `3px solid ${color}` }}>
            <div className="curve-fit-band-row__header">
                <span className="curve-fit-band-row__title">Band {bandIdx + 1}</span>
                <div className="curve-fit-band-row__controls">
                    <input
                        type="color"
                        value={color}
                        onChange={e => onChange('color', e.target.value)}
                        className="curve-fit-band-row__color"
                        title="Band color"
                        aria-label={`Band ${bandIdx + 1} color`}
                    />
                    <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={onRemove}
                        title="Remove this band"
                    >
                        <Minus size={12} />
                    </button>
                </div>
            </div>

            <div className="curve-fit-band-row__field">
                <label htmlFor={modeId} className="curve-fit-band-row__label">Mode</label>
                <select
                    id={modeId}
                    value={band.mode}
                    onChange={e => onChange('mode', e.target.value)}
                    className="form-select curve-fit-band-row__input"
                >
                    <option value="stddev">Std Dev from residuals (global)</option>
                    <option value="local_stddev">Local Std Dev (tapers with data)</option>
                    <option value="expression">Custom expressions</option>
                </select>
            </div>

            {(band.mode === 'stddev' || band.mode === 'local_stddev') && (
                <div className="curve-fit-band-row__field">
                    <label htmlFor={nStdId} className="curve-fit-band-row__label">N std</label>
                    <input
                        id={nStdId}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={band.nStdDev ?? 1}
                        onChange={e => onChange('nStdDev', parseFloat(e.target.value))}
                        className="form-input curve-fit-band-row__input"
                        placeholder="1"
                        title="Number of standard deviations"
                    />
                </div>
            )}

            {band.mode === 'local_stddev' && (
                <div className="curve-fit-band-row__field">
                    <label htmlFor={`band-nbins-${bandIdx}`} className="curve-fit-band-row__label">Bins</label>
                    <input
                        id={`band-nbins-${bandIdx}`}
                        type="number"
                        min="2"
                        max="30"
                        step="1"
                        value={band.nBins ?? 8}
                        onChange={e => onChange('nBins', parseInt(e.target.value, 10))}
                        className="form-input curve-fit-band-row__input"
                        placeholder="8"
                        title="Number of x-quantile bins for local std estimation — more bins = finer detail, fewer bins = smoother"
                    />
                </div>
            )}

            {band.mode === 'local_stddev' && (
                <div className="curve-fit-band-row__field curve-fit-band-row__field--slider">
                    <label htmlFor={`band-smoothing-${bandIdx}`} className="curve-fit-band-row__label">
                        Smoothing
                        <span className="curve-fit-band-row__slider-value">{((band.smoothing ?? 0.15) * 100).toFixed(0)}%</span>
                    </label>
                    <input
                        id={`band-smoothing-${bandIdx}`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={band.smoothing ?? 0.15}
                        onChange={e => onChange('smoothing', parseFloat(e.target.value))}
                        className="curve-fit-band-row__slider"
                        title="Kernel bandwidth — low = bands follow local variance closely, high = bands approach global average"
                    />
                </div>
            )}

            {band.mode === 'expression' && (
                <>
                    <div className="curve-fit-band-row__field">
                        <label htmlFor={upperExprId} className="curve-fit-band-row__label">Upper</label>
                        <input
                            id={upperExprId}
                            type="text"
                            value={band.upperExpr ?? ''}
                            onChange={e => onChange('upperExpr', e.target.value)}
                            className="form-input curve-fit-band-row__input curve-fit-band-row__input--mono"
                            placeholder="e.g. y * 1.235"
                            title="Upper band expression — use 'y' for the curve value, 'x' for x"
                        />
                    </div>
                    <div className="curve-fit-band-row__field">
                        <label htmlFor={lowerExprId} className="curve-fit-band-row__label">Lower</label>
                        <input
                            id={lowerExprId}
                            type="text"
                            value={band.lowerExpr ?? ''}
                            onChange={e => onChange('lowerExpr', e.target.value)}
                            className="form-input curve-fit-band-row__input curve-fit-band-row__input--mono"
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
        <div className="curve-fit-result">
            <div className="curve-fit-result__title">
                Curve {index + 1} Result:
            </div>
            <div>{result.equation}</div>
            <div className="curve-fit-result__detail">
                R² = {result.rSquared.toFixed(4)} (Goodness of fit)
            </div>
            {result.confidenceBands?.map((band, bi) => {
                if (!band) return null;
                const hasStdPct = band.upperStdPct != null && band.lowerStdPct != null;
                return (
                    <div key={`band-result-${band.upperStdPct ?? bi}-${band.lowerStdPct ?? 0}`} className="curve-fit-result__detail">
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
    graphConfig = {}
}) => {
    const graphSeries = Array.isArray(graphConfig.series)
        ? graphConfig.series
        : (Array.isArray(graphConfig.Series) ? graphConfig.Series : []);

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
                    <p className="card-subtitle">
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
                            {/* Row 1: identity — enable, color, series */}
                            <div className="curve-fit-row">
                                <label className="curve-fit-enable-label">
                                    <input
                                        type="checkbox"
                                        checked={curveFit.enabled}
                                        onChange={(e) => updateCurveFit(index, 'enabled', e.target.checked)}
                                        className="form-checkbox"
                                    />
                                    <span>Enabled</span>
                                </label>

                                <div className="curve-fit-field">
                                    <label className="curve-fit-field__label" htmlFor={`curve-fit-color-${index}`}>Color</label>
                                    <input
                                        id={`curve-fit-color-${index}`}
                                        type="color"
                                        className="form-input form-input-color"
                                        value={ScaleFactory.resolveColor(curveFit.color) || '#000000'}
                                        onChange={(e) => updateCurveFit(index, 'color', e.target.value)}
                                    />
                                </div>

                                {graphSeries.length > 0 && (
                                    <div className="curve-fit-field curve-fit-field--grow">
                                        <label className="curve-fit-field__label" htmlFor={`curve-fit-series-${index}`}>Series</label>
                                        <select
                                            id={`curve-fit-series-${index}`}
                                            value={curveFit.seriesIndex ?? 0}
                                            onChange={(e) => updateCurveFit(index, 'seriesIndex', parseInt(e.target.value, 10))}
                                            className="form-select"
                                        >
                                            {graphSeries.map((series, idx) => (
                                                <option key={series.yAxis ?? `series-${idx}`} value={idx}>
                                                    Series {idx + 1}: {series.titleName || series.yAxis || 'Unnamed'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Row 2: fit parameters — type, order, x range, stroke */}
                            <div className="curve-fit-row curve-fit-row--params">
                                <div className="curve-fit-field curve-fit-field--grow">
                                    <label className="curve-fit-field__label" htmlFor={`curve-fit-type-${index}`}>Fit type</label>
                                    <select
                                        id={`curve-fit-type-${index}`}
                                        value={curveFit.fitType}
                                        onChange={(e) => updateCurveFit(index, 'fitType', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="polynomial">Polynomial</option>
                                        <option value="power_law">Power law</option>
                                        <option value="exponential">Exponential</option>
                                        <option value="best_fit">Best fit (auto)</option>
                                        <option value="custom">Custom equation</option>
                                    </select>
                                </div>

                                {curveFit.fitType === 'polynomial' && (
                                    <div className="curve-fit-field curve-fit-field--narrow">
                                        <label className="curve-fit-field__label" htmlFor={`curve-fit-order-${index}`}>Order</label>
                                        <input
                                            id={`curve-fit-order-${index}`}
                                            type="number"
                                            min="1"
                                            max="6"
                                            value={curveFit.order}
                                            onChange={(e) => updateCurveFit(index, 'order', parseInt(e.target.value, 10))}
                                            className="form-input"
                                            aria-label={`Curve ${index + 1} polynomial order`}
                                        />
                                    </div>
                                )}

                                <div className="curve-fit-field curve-fit-field--narrow">
                                    <label className="curve-fit-field__label" htmlFor={`curve-fit-xmin-${index}`}>X min</label>
                                    <input
                                        id={`curve-fit-xmin-${index}`}
                                        type="number"
                                        step="any"
                                        value={curveFit.xMin}
                                        onChange={(e) => updateCurveFit(index, 'xMin', e.target.value)}
                                        placeholder={dataRange.min.toFixed(2)}
                                        className="form-input"
                                        aria-label={`Curve ${index + 1} minimum X`}
                                    />
                                </div>

                                <div className="curve-fit-field curve-fit-field--narrow">
                                    <label className="curve-fit-field__label" htmlFor={`curve-fit-xmax-${index}`}>X max</label>
                                    <input
                                        id={`curve-fit-xmax-${index}`}
                                        type="number"
                                        step="any"
                                        value={curveFit.xMax}
                                        onChange={(e) => updateCurveFit(index, 'xMax', e.target.value)}
                                        placeholder={dataRange.max.toFixed(2)}
                                        className="form-input"
                                        aria-label={`Curve ${index + 1} maximum X`}
                                    />
                                </div>

                                <div className="curve-fit-field">
                                    <label className="curve-fit-field__label" htmlFor={`curve-fit-line-style-${index}`}>Style</label>
                                    <select
                                        id={`curve-fit-line-style-${index}`}
                                        value={curveFit.lineStyle || 'solid'}
                                        onChange={(e) => updateCurveFit(index, 'lineStyle', e.target.value)}
                                        className="form-select"
                                        aria-label={`Curve ${index + 1} line style`}
                                    >
                                        <option value="solid">Solid</option>
                                        <option value="dashed">Dashed</option>
                                        <option value="dotted">Dotted</option>
                                        <option value="dash-dot">Dash-Dot</option>
                                    </select>
                                </div>

                                <div className="curve-fit-field curve-fit-field--narrow">
                                    <label className="curve-fit-field__label" htmlFor={`curve-fit-stroke-${index}`}>Stroke</label>
                                    <input
                                        id={`curve-fit-stroke-${index}`}
                                        type="number"
                                        min="1"
                                        max="6"
                                        value={curveFit.strokeWidth}
                                        onChange={(e) => updateCurveFit(index, 'strokeWidth', parseInt(e.target.value, 10))}
                                        className="form-input"
                                        aria-label={`Curve ${index + 1} stroke width`}
                                    />
                                </div>
                            </div>

                            {/* Custom equation input */}
                            {curveFit.fitType === 'custom' && (
                                <div className="curve-fit-custom-eq">
                                    <input
                                        type="text"
                                        value={curveFit.customEquation ?? ''}
                                        onChange={(e) => updateCurveFit(index, 'customEquation', e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. 30.65 * x^(0.2286)"
                                        title="Enter your equation using x as the variable. Supports +, -, *, /, ^ and parentheses."
                                        aria-label={`Curve ${index + 1} custom equation`}
                                    />
                                    <p className="curve-fit-custom-eq__hint">
                                        Use <code>x</code> as the variable. Operators: <code>+ - * / ^</code> and parentheses.
                                        R² is computed against the selected series.
                                    </p>
                                </div>
                            )}

                            {/* Confidence bands section */}
                            <div className="curve-fit-bands">
                                <div className="curve-fit-bands__header">
                                    <label className="curve-fit-bands__label">
                                        <input
                                            type="checkbox"
                                            checked={bands.enabled}
                                            onChange={(e) => updateBands(index, curveFit, prev => ({ ...prev, enabled: e.target.checked }))}
                                            className="form-checkbox"
                                        />
                                        <span>Confidence Bands</span>
                                    </label>
                                    {bands.enabled && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => addBand(index, curveFit)}
                                            title="Add a confidence band"
                                        >
                                            <Plus size={12} /> Add Band
                                        </button>
                                    )}
                                </div>

                                {bands.enabled && bands.bands.length > 0 && (
                                    <div className="curve-fit-bands__list">
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
