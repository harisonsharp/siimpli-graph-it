
import React, { useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

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

    // Drag-and-drop functionality removed

    const handleFileChange = (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            alert('No files selected.');
            return;
        }
        for (let file of files) {
            if (!file.name.toLowerCase().endsWith('.csv')) {
                alert(`Invalid file type: ${file.name}`);
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert(`File too large: ${file.name}`);
                return;
            }
        }
        onFileUpload(files);
    };

    // Drag-and-drop handlers removed
    const handleClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    return (
        <>
            <style>{`
            .file-upload-section {
                transition: box-shadow 0.3s, transform 0.3s, border 0.3s;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                border-radius: 12px;
                border: 2px solid transparent;
                padding: 32px 24px 24px 24px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }
            .file-upload-content {
                width: 100%;
                text-align: center;
            }
            .file-upload-text {
                font-size: 1.1rem;
                color: #333;
                margin: 12px 0 4px 0;
                line-height: 1.5;
            }
            .file-upload-content strong {
                font-weight: 600;
                color: #1976d2;
            }
            .file-upload-content p {
                margin: 8px 0;
            }
            .file-upload-section:hover {
                box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                transform: translateY(-2px) scale(1.03);
                background: linear-gradient(90deg, #e3f2fd 0%, #fce4ec 100%);
                border: 2px solid #1976d2;
            }
            .file-upload-section:active {
                transform: scale(0.98);
                border: 2px solid #d81b60;
            }
        `}</style>
            <section className="app-section">
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Upload CSV Files</h2>
                        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
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
                            style={{ cursor: 'pointer' }}
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
                                <Upload size={56} style={{ color: 'var(--primary-color)', marginBottom: '16px', transition: 'transform 0.3s' }} />
                                <p className="file-upload-text">
                                    <strong>Click to select CSV files</strong>
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Supports multiple file selection • Maximum file size: 10MB
                                </p>
                            </div>
                        </div>
                        {csvFiles.length > 0 && (
                            <div className="file-list">
                                <h3>
                                    Loaded Files ({csvFiles.length})
                                </h3>
                                {csvFiles.map((file, index) => (
                                    <div key={index} className="file-item">
                                        <div className="file-item-info">
                                            <FileText size={24} style={{ color: 'var(--success-color)' }} />
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
        </>
    );
};


export default FileUploadSection;
