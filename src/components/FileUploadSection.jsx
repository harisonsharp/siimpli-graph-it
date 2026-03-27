
import React, { useRef, useEffect } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { useError } from '@harisonsharp/graph-it-core';

/**
 * @fileoverview CSV file upload interface component with drag-and-drop support and file management.
 * Provides file selection controls, displays loaded file information, and manages file removal operations
 * for the data import workflow in the scientific visualization application.
 *
 * @author Harison Sharp
 * @since 0.2.0
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library with hooks (useRef)
 * @requires lucide-react - Icon components for UI elements (Upload, FileText, X)
 *
 * @param {Object} props - Component props
 * @param {Array} props.csvFiles - Array of loaded CSV file objects with metadata
 * @param {Function} props.onFileUpload - Callback for file upload handling
 * @param {Function} props.onRemoveFile - Callback for file removal operations
 *
 * @exports default FileUploadSection
 *
 * @example
 * <FileUploadSection csvFiles={files} onFileUpload={handleUpload} onRemoveFile={removeFile} />
 *
 * @related FileService.js, GraphApp.jsx, FileUploadCard.jsx
 */



const FileUploadSection = ({ csvFiles, onFileUpload, onRemoveFile }) => {
    const fileInputRef = useRef();
    const { handleError } = useError();

    // Reset the hidden input whenever the file list changes so identical files can be re-selected
    useEffect(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [csvFiles.length]);

    const handleFileChange = async (event) => {
        const target = event.target;
        const files = target.files ? Array.from(target.files) : [];
        if (files.length === 0) return;
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.csv')) {
                handleError(new Error(`Invalid file type: ${file.name}`), `"${file.name}" is not a CSV file. Please select .csv files only.`);
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                handleError(new Error(`File too large: ${file.name}`), `"${file.name}" exceeds the 10 MB size limit.`);
                return;
            }
        }
        try {
            await onFileUpload(files);
        } finally {
            target.value = '';
        }
    };

    const handleClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    return (
        <section className="app-section">
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Upload CSV Files</h2>
                        <p className="card-subtitle">
                            Upload one or more CSV files to begin creating your graph visualization
                        </p>
                    </div>
                    <div className="card-body">
                        <div
                            className="file-upload-section"
                            onClick={handleClick}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleClick();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                multiple
                                accept=".csv"
                                onChange={handleFileChange}
                            />
                            <div className="file-upload-content">
                                <Upload size={40} className="file-upload-icon" />
                                <p className="file-upload-text">
                                    <strong>Click to select CSV files</strong>
                                </p>
                                <p className="file-upload-hint">
                                    Multiple files supported &nbsp;·&nbsp; 10 MB max per file
                                </p>
                            </div>
                        </div>

                        {csvFiles.length === 0 && (
                            <ol className="upload-workflow-steps">
                                <li className="upload-workflow-step">
                                    <span className="upload-workflow-step__num">1</span>
                                    <div>
                                        <strong>Upload CSV</strong>
                                        <span>Columns are detected automatically from headers</span>
                                    </div>
                                </li>
                                <li className="upload-workflow-step">
                                    <span className="upload-workflow-step__num">2</span>
                                    <div>
                                        <strong>Configure axes</strong>
                                        <span>Map columns to X and Y axes, set chart type and labels</span>
                                    </div>
                                </li>
                                <li className="upload-workflow-step">
                                    <span className="upload-workflow-step__num">3</span>
                                    <div>
                                        <strong>Export</strong>
                                        <span>Download a publication-ready PNG or save the config for batch use</span>
                                    </div>
                                </li>
                            </ol>
                        )}
                        {csvFiles.length > 0 && (
                            <div className="file-list">
                                <h3>
                                    Loaded Files ({csvFiles.length})
                                </h3>
                                {csvFiles.map((file, index) => (
                                    <div key={index} className="file-item">
                                        <div className="file-item-info">
                                            <FileText size={24} className="file-item-icon" />
                                            <div>
                                                <div className="file-item-name">{file.name}</div>
                                                <div className="file-item-size">
                                                    {file.headers.length} columns • Ready for visualization
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => onRemoveFile(file.name)}
                                            title="Remove file"
                                        >
                                            <X size={16} />
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
        </section>
    );
};


export default FileUploadSection;
