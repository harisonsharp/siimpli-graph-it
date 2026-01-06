import React, { useRef, useEffect } from 'react';
/**
 * @fileoverview Display component for rendering loaded graph images with dimension tracking and overlay support.
 * Handles image loading events, dimension calculations, and provides SVG overlay capabilities for annotations
 * and interactive elements in the visualization interface.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @performance Optimized with React.memo to prevent unnecessary re-renders
 * @updated 2025-01-01 Phase 9: Added React.memo optimization
 *
 * @component React Functional Component
 * @type {React.FC}
 *
 * @requires react - Core React library with hooks (useRef, useEffect)
 *
 * @param {Object} props - Component props
 * @param {string} props.imageUrl - URL of the image to display
 * @param {Object} props.imageDimensions - Current image dimensions object
 * @param {Function} props.onImageLoad - Callback fired when image loads with actual dimensions
 *
 * @exports default GraphImageDisplay
 *
 * @example
 * <GraphImageDisplay imageUrl={url} onImageLoad={handleDimensions} />
 *
 * @related ImageExportService.js, GraphRenderer.jsx, FileUploadCard.jsx
 */

const GraphImageDisplay = React.memo(({
                               imageUrl,
                               imageDimensions,
                               onImageLoad
                           }) => {
    const imageRef = useRef();
    const svgRef = useRef();

    // Handle image load to get dimensions
    useEffect(() => {
        if (imageUrl && imageRef.current) {
            const handleImageLoad = () => {
                if (imageRef.current) {
                    const actualDimensions = {
                        width: imageRef.current.naturalWidth,
                        height: imageRef.current.naturalHeight
                    };
                    onImageLoad(actualDimensions);
                }
            };

            imageRef.current.onload = handleImageLoad;
            imageRef.current.onerror = () => {
                console.error('Failed to load image');
            };
        }
    }, [imageUrl, onImageLoad]);

    return {
        component: (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Graph Image</h3>
                </div>
                <div className="card-body p-0">
                    <div className="filename-image-container">
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Graph"
                            className="filename-image"
                        />
                        <svg
                            ref={svgRef}
                            className="filename-overlay"
                            width={imageDimensions.width}
                            height={imageDimensions.height}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none'
                            }}
                        />
                    </div>
                </div>
            </div>
        ),
        svgRef
    };
});

GraphImageDisplay.displayName = 'GraphImageDisplay';

export default GraphImageDisplay;
