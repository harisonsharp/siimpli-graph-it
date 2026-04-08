/**
 * @fileoverview Custom React hook encapsulating all zoom and pan behaviour for
 * the SVG graph canvas.
 *
 * Responsibilities:
 *  - Wrapping the D3-rendered plot children into a clip/data group hierarchy
 *    so that a single CSS transform moves all data without disturbing axes or labels.
 *  - Injecting a `<clipPath>` into the SVG `<defs>` (without destroying pre-existing
 *    defs such as gradient definitions produced by LegendRenderer).
 *  - Attaching a D3 zoom behavior to an invisible capture rect confined to the
 *    data region, so wheel/drag events do not fire over the margin/label area.
 *  - Rescaling axis tick generators on every zoom event to keep labels in sync
 *    with the transformed data.
 *  - Exposing imperative `zoomIn`, `zoomOut`, and `reset` handles and the
 *    reactive `zoomLevel` / `isPanning` UI-state values consumed by the controls.
 *
 * @author Harison Sharp
 * @since 0.4.0
 *
 * @module useGraphZoom
 * @requires react
 * @requires d3
 *
 * @exports useGraphZoom
 */

import { useCallback, useRef, useState } from 'react';
import * as d3 from 'd3';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 20;
export const ZOOM_STEP = 1.4;

// ---------------------------------------------------------------------------
// Axis-element classifier
// Elements in this set belong to the fixed scaffold — they must not move or
// be clipped when the user zooms/pans the data layer.
// ---------------------------------------------------------------------------

const AXIS_CLASSES = new Set([
    'x-axis', 'y-axis', 'y-axis-primary', 'y-axis-secondary',
    'x-axis-label', 'y-axis-label', 'y-axis-label-primary', 'y-axis-label-secondary',
    'guide-lines',
]);

function isAxisOrLabel(el) {
    const classes = (el.getAttribute('class') || '').split(/\s+/);
    return classes.some(c => AXIS_CLASSES.has(c));
}

// ---------------------------------------------------------------------------
// Axis tick formatter
// Mirrors axisUtils.js formatNumber from @harisonsharp/graph-it-core.
// Replicated here because the function is not exported from the package.
// ---------------------------------------------------------------------------

function formatAxisNumber(value, thresholdDigits) {
    if (value === 0) return '0';
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '';
    const absVal = Math.abs(value);
    const intPart = Math.floor(absVal).toString();
    if (intPart.length > thresholdDigits) return d3.format('.2e')(value);
    if (absVal > 999) {
        return Number.isInteger(value)
            ? d3.format(',')(value)
            : d3.format(',~f')(value);
    }
    return String(value);
}

function getStaticScale(config, axisKey) {
    const axisScale = config?.staticScales?.[axisKey];
    if (!axisScale || axisScale.enabled !== true) return null;

    const min = Number.parseFloat(axisScale.min);
    const max = Number.parseFloat(axisScale.max);
    const step = Number.parseFloat(axisScale.step);

    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) return null;
    if (max <= min || step <= 0) return null;

    return { min, max, step };
}

function buildTickValues(min, max, step, maxTicks = 500) {
    const ticks = [];
    let index = 0;
    let current = min;

    while (current <= max + (step * 1e-6) && index < maxTicks) {
        ticks.push(Number(current.toFixed(12)));
        index += 1;
        current = min + (index * step);
    }

    if (ticks.length > 0 && ticks[ticks.length - 1] !== max) {
        ticks.push(max);
    }

    return ticks;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Attaches D3 zoom/pan to an already-rendered SVG graph and returns imperative
 * controls plus reactive UI state.
 *
 * @param {React.RefObject<SVGSVGElement>} svgRef - Ref to the SVG root element.
 * @param {React.RefObject<Object>}        graphConfigRef - Ref whose `.current`
 *   always holds the latest graph config (used for log-axis tick formatting).
 *
 * @returns {{
 *   setupZoom:    () => void,
 *   zoomIn:       () => void,
 *   zoomOut:      () => void,
 *   resetZoom:    () => void,
 *   zoomLevel:    number,
 *   isPanning:    boolean,
 * }}
 */
export function useGraphZoom(svgRef, graphConfigRef) {
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isPanning, setIsPanning] = useState(false);

    // Stable imperative handles — written inside setupZoom, read by controls
    const zoomBehaviorRef = useRef(null);
    const zoomTargetRef   = useRef(null);

    /**
     * Call once after the graph has been fully rendered into the SVG.
     * Accepts the scale objects and plot dimensions returned by `generateGraph`.
     *
     * @param {{ xScale, yScale, yScale2 }} scales
     * @param {{ width: number, height: number }}  plotDims
     */
    const setupZoom = useCallback((scales, plotDims) => {
        const svgNode = svgRef.current;
        if (!svgNode || !scales || !plotDims) return;

        const { xScale, yScale, yScale2 } = scales;
        const { width: plotWidth, height: plotHeight } = plotDims;

        const svg = d3.select(svgNode);

        // The single margin-translated group that holds everything
        const plotGroup = svg.select('g');
        if (plotGroup.empty()) return;

        // ------------------------------------------------------------------
        // 1. Wrap data-layer children into a clip+data group hierarchy.
        //    Axes, labels, and guide-lines stay outside so they never move.
        //
        //    DOM structure after setup:
        //      g (plotGroup)
        //        ├── .x-axis / .y-axis-* / .guide-lines  (fixed)
        //        ├── rect.zoom-capture                    (event target)
        //        └── g.plot-clip  [clip-path=url(#zoom-clip)]
        //              └── g.plot-data  [transform=zoomTransform]
        //                    └── … all data elements
        // ------------------------------------------------------------------
        plotGroup.select('g.plot-clip').remove(); // clean up if re-running
        // Remove the static grid drawn at render time; zoom handler owns it from here on
        plotGroup.select('.guide-lines').remove();

        const childNodes = Array.from(plotGroup.node().childNodes);

        // ------------------------------------------------------------------
        // 2. Inject clipPath into existing <defs> to avoid destroying gradient
        //    definitions that LegendRenderer appended during graph generation.
        // ------------------------------------------------------------------
        const clipId = 'zoom-clip';
        svg.select(`#${clipId}`).remove();
        let defs = svg.select('defs');
        if (defs.empty()) {
            defs = svg.insert('defs', ':first-child');
        }
        defs.append('clipPath')
            .attr('id', clipId)
            .append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', plotWidth).attr('height', plotHeight);

        // Static clipping container — clip-path applied here, never transformed
        const clipGroup = plotGroup.append('g')
            .attr('class', 'plot-clip')
            .attr('clip-path', `url(#${clipId})`);

        // Inner group that receives the zoom transform
        const dataWrapper = clipGroup.append('g').attr('class', 'plot-data');

        // Reparent all non-axis children into the inner wrapper
        childNodes.forEach(child => {
            if (child.nodeType !== 1) return;
            if (!isAxisOrLabel(child)) {
                dataWrapper.node().appendChild(child);
            }
        });

        // ------------------------------------------------------------------
        // 3. Invisible capture rect — confines wheel/drag to the data region.
        //    Insert directly before clipGroup using the DOM node as reference
        //    to avoid a selector-based lookup that can fail if the element has
        //    moved during the reparent step above.
        // ------------------------------------------------------------------
        plotGroup.select('.zoom-capture').remove();
        const captureEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        plotGroup.node().insertBefore(captureEl, clipGroup.node());
        d3.select(captureEl)
            .attr('class', 'zoom-capture')
            .attr('x', 0).attr('y', 0)
            .attr('width', plotWidth).attr('height', plotHeight)
            .attr('fill', 'none')
            .attr('pointer-events', 'all');

        // Fresh guide-lines group owned by zoom — inserted before clipGroup so it
        // renders behind data but above the axis lines.
        plotGroup.select('.guide-lines').remove();
        const guideGroupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        plotGroup.node().insertBefore(guideGroupEl, clipGroup.node());
        d3.select(guideGroupEl)
            .attr('class', 'guide-lines')
            .style('opacity', 0.15);

        // ------------------------------------------------------------------
        // 4. Axis generators for live tick rescaling during zoom
        // ------------------------------------------------------------------
        const config = graphConfigRef.current;
        const staticXScale = getStaticScale(config, 'x');
        const staticYScale = getStaticScale(config, 'y');
        const staticY2Scale = getStaticScale(config, 'y2');
        const staticXTicks = staticXScale ? buildTickValues(staticXScale.min, staticXScale.max, staticXScale.step) : null;
        const staticYTicks = staticYScale ? buildTickValues(staticYScale.min, staticYScale.max, staticYScale.step) : null;
        const staticY2Ticks = staticY2Scale ? buildTickValues(staticY2Scale.min, staticY2Scale.max, staticY2Scale.step) : null;
        const xDomain = xScale.domain();
        const xIsTimeScale = xDomain.length > 0 && xDomain[0] instanceof Date;
        const xAxisGen = d3.axisBottom(xScale)
            .tickSizeOuter(0)
            .tickFormat(xIsTimeScale
                ? d3.timeFormat('%Y/%m/%d')
                : config?.logX
                    ? d => Number(d.toPrecision(4)).toString()
                    : d => formatAxisNumber(d, 6));
        if (staticXTicks && !xIsTimeScale) {
            xAxisGen.tickValues(staticXTicks);
        }
        const yAxisGen = d3.axisLeft(yScale)
            .tickSizeOuter(0)
            .tickFormat(config?.logY
                ? d => Number(d.toPrecision(4)).toString()
                : d => formatAxisNumber(d, 8));
        if (staticYTicks) {
            yAxisGen.tickValues(staticYTicks);
        }
        const y2AxisGen = yScale2
            ? d3.axisRight(yScale2).tickSizeOuter(0).tickFormat(d => formatAxisNumber(d, 8))
            : null;
        if (y2AxisGen && staticY2Ticks) {
            y2AxisGen.tickValues(staticY2Ticks);
        }

        const xAxisGroup    = plotGroup.select('.x-axis');
        const yAxisGroup    = plotGroup.select('.y-axis-primary');
        const y2AxisGroup   = plotGroup.select('.y-axis-secondary');
        const guideGroup    = d3.select(guideGroupEl);

        // ------------------------------------------------------------------
        // 5. D3 zoom behavior
        // ------------------------------------------------------------------
        const zoom = d3.zoom()
            .scaleExtent([MIN_ZOOM, MAX_ZOOM])
            .translateExtent([
                [-plotWidth  * 0.5, -plotHeight * 0.5],
                [ plotWidth  * 1.5,  plotHeight * 1.5],
            ])
            .on('start', (event) => {
                if (event.sourceEvent?.type === 'mousedown') setIsPanning(true);
            })
            .on('zoom', (event) => {
                const { transform } = event;
                setZoomLevel(Math.round(transform.k * 100) / 100);

                dataWrapper.attr('transform', transform);

                const rescaledX = transform.rescaleX(xScale);
                const rescaledY = transform.rescaleY(yScale);

                if (!xAxisGroup.empty()) {
                    xAxisGroup.call(xAxisGen.scale(rescaledX));
                }
                if (!yAxisGroup.empty()) {
                    yAxisGroup.call(yAxisGen.scale(rescaledY));
                }
                if (y2AxisGen && !y2AxisGroup.empty()) {
                    y2AxisGroup.call(y2AxisGen.scale(transform.rescaleY(yScale2)));
                }

                // Reposition grid lines to follow the rescaled axis ticks
                if (!guideGroup.empty()) {
                    const yTicks = staticYTicks || (rescaledY.ticks ? rescaledY.ticks() : []);
                    const xTicks = staticXTicks || (rescaledX.ticks ? rescaledX.ticks() : []);

                    // Rebuild horizontal lines from y-ticks
                    guideGroup.selectAll('line.grid-h').remove();
                    yTicks.forEach(tick => {
                        const y = rescaledY(tick);
                        if (y >= 0 && y <= plotHeight) {
                            guideGroup.append('line')
                                .attr('class', 'grid-h')
                                .attr('x1', 0).attr('x2', plotWidth)
                                .attr('y1', y).attr('y2', y)
                                .style('stroke', '#999')
                                .style('stroke-width', 1)
                                .style('stroke-dasharray', '2,3');
                        }
                    });

                    // Rebuild vertical lines from x-ticks
                    guideGroup.selectAll('line.grid-v').remove();
                    xTicks.forEach(tick => {
                        const x = rescaledX(tick);
                        if (x >= 0 && x <= plotWidth) {
                            guideGroup.append('line')
                                .attr('class', 'grid-v')
                                .attr('x1', x).attr('x2', x)
                                .attr('y1', 0).attr('y2', plotHeight)
                                .style('stroke', '#999')
                                .style('stroke-width', 1)
                                .style('stroke-dasharray', '2,3');
                        }
                    });
                }
            })
            .on('end', () => setIsPanning(false));

        const captureRect = d3.select(captureEl);
        captureRect.call(zoom);
        // Suppress double-click zoom — conflicts with data-point click interactions
        captureRect.on('dblclick.zoom', null);

        // Draw initial grid at identity transform (no zoom yet)
        captureRect.call(zoom.transform, d3.zoomIdentity);

        zoomBehaviorRef.current = zoom;
        zoomTargetRef.current   = captureRect;
    }, [svgRef, graphConfigRef]);

    // ------------------------------------------------------------------
    // Imperative controls
    // ------------------------------------------------------------------

    const zoomIn = useCallback(() => {
        if (!zoomTargetRef.current || !zoomBehaviorRef.current) return;
        zoomTargetRef.current.transition().duration(220)
            .call(zoomBehaviorRef.current.scaleBy, ZOOM_STEP);
    }, []);

    const zoomOut = useCallback(() => {
        if (!zoomTargetRef.current || !zoomBehaviorRef.current) return;
        zoomTargetRef.current.transition().duration(220)
            .call(zoomBehaviorRef.current.scaleBy, 1 / ZOOM_STEP);
    }, []);

    const resetZoom = useCallback(() => {
        if (!zoomTargetRef.current || !zoomBehaviorRef.current) return;
        zoomTargetRef.current.transition().duration(300)
            .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }, []);

    return { setupZoom, zoomIn, zoomOut, resetZoom, zoomLevel, isPanning };
}
