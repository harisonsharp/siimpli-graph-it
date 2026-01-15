import { useCallback } from 'react';
import { useGraphRenderer } from './useGraphRenderer.js';
import { adaptBatchConfig, debugLog, debugWarn } from '@siimpli/graph-it-core';

/**
 * @fileoverview Wrapper hook that adapts legacy batch generation calls to the
 * unified useGraphRenderer API.
 */

export function useBatchGraphRenderer({
	globalSettings,
	colorSchemes,
	logoImage,
	getAxisIntercepts
}) {
	const { generateGraph } = useGraphRenderer({
		csvData: [],
		graphConfig: {},
		curveFits: [],
		globalSettings,
		logoImage,
		logoReady: true,
		getAxisIntercepts,
		colorSchemes,
		isBatchMode: true
	});

	const legacyGenerateGraph = useCallback((csvData, config, svgRef, settings, schemes, intercepts) => {
		return generateGraph(
			svgRef,
			null,
			null,
			{
				csvData,
				graphConfig: adaptBatchConfig(config),
				globalSettings: settings || globalSettings,
				colorSchemes: schemes || colorSchemes,
				logoImage,
				logoReady: true,
				curveFits: config.curveFits || [],
				isBatchMode: true
			}
		);
	}, [generateGraph, globalSettings, colorSchemes, logoImage]);

	return { generateGraph: legacyGenerateGraph };
}
