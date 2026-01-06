import React from 'react';
import { Plus, Minus } from 'lucide-react';

/**
 * @fileoverview Interactive UI panel for configuring and controlling mathematical curve fitting operations.
 * Provides form controls for polynomial order, fit ranges, and curve management with real-time parameter adjustment.
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
 *
 * @example
 * <CurveFittingPanel curveFits={fits} dataRange={range} onPerformFitting={handleFit} />
 *
 * @relatedFiles curveFittingUtils.js, ConfigContext.jsx - Uses curve fitting algorithms and configuration state
 */

const CurveFittingPanel = ({
                               curveFits,
                               dataRange,
                               onPerformFitting,
                               updateCurveFit,
                               addCurveFit,
                               removeCurveFit,
                               seriesInfo = []
                           }) => {
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
                        className="btn btn-sm btn-primary"
                        onClick={onPerformFitting}
                        title="Calculate curve fits for all enabled curves"
                    >
                        Fit Curves
                    </button>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={addCurveFit}
                        title="Add a new curve configuration"
                    >
                        <Plus size={16} />
                        Add Curve
                    </button>
                    {curveFits.length > 1 && (
                        <button
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
                {curveFits.map((curveFit, index) => (
                    <div key={index} className="curve-fit-item">
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
                            ></div>

                            {seriesInfo.length > 0 && (
                                <div className="form-group" style={{ margin: 0 }}>
                                    <select
                                        value={curveFit.seriesIndex ?? 0}
                                        onChange={(e) => updateCurveFit(index, 'seriesIndex', parseInt(e.target.value))}
                                        className="form-select"
                                        style={{ fontSize: '14px' }}
                                        title="Select which data series to fit"
                                    >
                                        {seriesInfo.map((series, idx) => (
                                            <option key={idx} value={idx}>
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
                                >
                                    <option value="polynomial">Polynomial Fit</option>
                                    <option value="power_law">Power Law Fit</option>
                                    <option value="best_fit">Best Fit Auto</option>
                                </select>
                            </div>

                            {curveFit.fitType === 'polynomial' && (
                                <div className="form-group" style={{ margin: 0 }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="6"
                                        value={curveFit.order}
                                        onChange={(e) => updateCurveFit(index, 'order', parseInt(e.target.value))}
                                        className="form-input"
                                        placeholder="Polynomial Order"
                                        title="Polynomial order (1-6)"
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
                                    title="Minimum X value for curve fitting range"
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
                                    title="Maximum X value for curve fitting range"
                                    style={{ fontSize: '14px' }}
                                />
                            </div>
                        </div>

                        {curveFit.result && (
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
                                <div>{curveFit.result.equation}</div>
                                <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                                    R² = {curveFit.result.rSquared.toFixed(4)} (Goodness of fit)
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CurveFittingPanel;
