import { useState, useCallback } from 'react';
/**
 * @fileoverview React hook providing centralized error state management and user notifications.
 * Manages error display with automatic timeout functionality for consistent
 * error handling across the data visualization application.
 *
 * @author Harison Sharp
 * @since 0.2.0
 * @module useErrorHandler
 *
 * @description Lightweight custom hook for managing application error states with automatic
 * cleanup. Provides consistent error messaging interface with configurable display duration
 * for user-friendly error feedback in the scientific visualization workflow.
 *
 * @requires react - useState and useCallback hooks for state management
 *
 * @returns {Object} Error state and management functions
 *
 * @example
 * const { error, showError, clearError } = useErrorHandler();
 * showError('Invalid data format');
 *
 * @relatedFiles useFileProcessing.js, useImageLoader.js, useGraphGeneration.js
 */

export const useErrorHandler = () => {
    const [error, setError] = useState(null);

    const showError = useCallback((message) => {
        setError(message);
        setTimeout(() => setError(null), 5000);
    }, []);

    const clearError = () => setError(null);

    return { error, showError, clearError };
};
