

import React from 'react';
import { BarChart3, Settings, Eye } from 'lucide-react';

/**
 * @fileoverview Main navigation header component providing mode switching functionality for the data visualization application.
 * Renders navigation buttons for switching between different application modes (chart, settings, view) with appropriate icons.
 *
 * @author Harison Sharp
 * @since 0.2.0
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library for component creation
 * @requires lucide-react - Icon components for navigation buttons (BarChart3, Settings, Eye)
 *
 * @param {Object} props - Component props
 * @param {string} props.mode - Current active mode state
 * @param {Function} props.setMode - Function to update the current mode
 *
 * @exports default AppHeader
 *
 * @example
 * <AppHeader mode="chart" setMode={setMode} />
 * <AppHeader mode="settings" setMode={handleModeChange} />
 *
 * @relatedFiles ConfigContext.jsx, constants.js - Works with global application state and configuration
 */

const AppHeader = ({ mode, setMode }) => {


    return (
        <header className="app-header">
            <h1 className="app-title">Graph Generator</h1>
            <div className="mode-tabs">
                <button
                    className={`mode-tab ${mode === 'manual' ? 'mode-tab-active' : ''}`}
                    onClick={() => setMode('manual')}
                >
                    <BarChart3 size={16} />
                    Manual Mode
                </button>
                <button
                    className={`mode-tab ${mode === 'batch' ? 'mode-tab-active' : ''}`}
                    onClick={() => setMode('batch')}
                >
                    <Settings size={16} />
                    Batch Mode
                </button>
                <button
                    className={`mode-tab ${mode === 'decoder' ? 'mode-tab-active' : ''}`}
                    onClick={() => setMode('decoder')}
                >
                    <Eye size={16} />
                    Filename Decoder
                </button>
            </div>
        </header>
    );
};

export default AppHeader;
