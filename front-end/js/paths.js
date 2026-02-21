/**
 * paths.js - Main paths/edges management
 * Contains core state, utilities, and geometry helpers
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    tool: 'select',
    objects: [],
    
    // Multi-selection support
    selectedObjectIds: [],      // Array of selected object IDs
    selectedPointIndices: [],   // Array of {objectId, pointIndex} for selected points
    selectedEdgeIndices: [],    // Array of {objectId, edgeIndex} for selected edges
    
    // Legacy single selection (kept for compatibility)
    selectedObjectId: null,
    selectedPointIndex: null,
    selectedEdgeIndex: null,
    
    interaction: null, 
    dragStart: { x: 0, y: 0 },
    resizeHandle: null,
    
    initialPoints: {},  // Object keyed by objectId containing arrays of points
    initialBbox: null,
    initialEdges: {},   // Object keyed by objectId containing arrays of edges
    rotationCenter: null, 
    
    objectCounter: 0,
    polygonSides: 6,
    fillColor: '#10b981',
    strokeColor: '#ffffff',
    strokeWidth: 2,

    // Drawing State
    drawingPoints: null, 
    drawingEdges: null,  
    currentMouse: {x:0, y:0},
    
    // Arc Specifics
    arcAngle: 90,
    arcSweep: 1,
    arcAngularity: false,
    
    // Selection box state
    selectionBox: null,         // {x, y, width, height} for marquee selection
    isSelecting: false          // True during marquee selection
};

// ============================================
// UTILITIES
// ============================================

const generateId = () => 'obj_' + (++state.objectCounter);

const getMousePos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const dist = (p1, p2) => Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2);

// ============================================
// BOUNDING BOX
// ============================================

function getBoundingBox(points) {
    if (!points || points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function getTransformedBoundingBox(obj) {
    return getBoundingBox(obj.points);
}

// ============================================
// GEOMETRY HELPERS
// ============================================

/**
 * Calculate Arc parameters from chord and angle
 */
function getArcParamsFromAngle(p1, p2, angleDeg, sweep) {
    const chord = dist(p1, p2);
    if (chord < 1) return { type: 'line', rx: 0, ry: 0, rotation: 0, largeArc: 0, sweep };

    const effectiveAngle = state.arcAngularity ? 180 : angleDeg;

    const theta = (effectiveAngle * Math.PI) / 180;
    const sinHalfTheta = Math.sin(theta / 2);
    const R = sinHalfTheta > 0.001 ? chord / (2 * sinHalfTheta) : 9999;

    return {
        type: 'arc',
        rx: Math.abs(R),
        ry: Math.abs(R),
        rotation: 0,
        largeArc: effectiveAngle > 180 ? 1 : 0,
        sweep: sweep
    };
}

/**
 * Generates only the SVG curve command for an arc
 */
function getArcCurveCommand(p1, p2, edge) {
    if (!edge || (edge.type && edge.type === 'line')) return `L ${p2.x} ${p2.y}`;
    if (edge.type === 'arc' || (edge.rx !== undefined)) {
        const { rx, ry, rotation, largeArc, sweep } = edge;
        const rX = Math.max(0.1, rx || 0.1);
        const rY = Math.max(0.1, ry || 0.1);
        return `A ${rX} ${rY} ${rotation||0} ${largeArc||0} ${sweep||0} ${p2.x} ${p2.y}`;
    }
    return `L ${p2.x} ${p2.y}`;
}

// ============================================
// SELECTION MANAGEMENT
// ============================================

/**
 * Clear all selections
 */
function clearSelections() {
    state.selectedObjectIds = [];
    state.selectedPointIndices = [];
    state.selectedEdgeIndices = [];
    state.selectedObjectId = null;
    state.selectedPointIndex = null;
    state.selectedEdgeIndex = null;
}

/**
 * Check if an object is selected
 */
function isObjectSelected(objectId) {
    return state.selectedObjectIds.includes(objectId) || state.selectedObjectId === objectId;
}

/**
 * Check if a point is selected
 */
function isPointSelected(objectId, pointIndex) {
    return state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === pointIndex) ||
           (state.selectedObjectId === objectId && state.selectedPointIndex === pointIndex);
}

/**
 * Check if an edge is selected
 */
function isEdgeSelected(objectId, edgeIndex) {
    return state.selectedEdgeIndices.some(e => e.objectId === objectId && e.edgeIndex === edgeIndex) ||
           (state.selectedObjectId === objectId && state.selectedEdgeIndex === edgeIndex);
}

/**
 * Select an object (with optional multi-select mode)
 */
function selectObject(objectId, addToSelection = false) {
    if (!addToSelection) {
        clearSelections();
    }
    
    if (!state.selectedObjectIds.includes(objectId)) {
        state.selectedObjectIds.push(objectId);
    }
    state.selectedObjectId = objectId;
    
    // When selecting an object, select all its edges and points
    const obj = state.objects.find(o => o.id === objectId);
    if (obj) {
        // Select all edges
        obj.edges.forEach((_, i) => {
            if (!state.selectedEdgeIndices.some(e => e.objectId === objectId && e.edgeIndex === i)) {
                state.selectedEdgeIndices.push({ objectId, edgeIndex: i });
            }
        });
        
        // Select all points
        obj.points.forEach((_, i) => {
            if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === i)) {
                state.selectedPointIndices.push({ objectId, pointIndex: i });
            }
        });
    }
}

/**
 * Select a point (with optional multi-select mode)
 */
function selectPoint(objectId, pointIndex, addToSelection = false) {
    if (!addToSelection) {
        clearSelections();
    }
    
    const key = { objectId, pointIndex };
    if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === pointIndex)) {
        state.selectedPointIndices.push(key);
    }
    
    state.selectedObjectId = objectId;
    state.selectedPointIndex = pointIndex;
    
    // Ensure the object is in selection
    if (!state.selectedObjectIds.includes(objectId)) {
        state.selectedObjectIds.push(objectId);
    }
    
    // Check if two points of the same edge are selected, then select the edge
    syncPointToEdgeSelection(objectId);
}

/**
 * Select a range of points (for shift+click range selection)
 */
function selectPointRange(objectId, fromIndex, toIndex) {
    const obj = state.objects.find(o => o.id === objectId);
    if (!obj) return;
    
    const minIdx = Math.min(fromIndex, toIndex);
    const maxIdx = Math.max(fromIndex, toIndex);
    
    for (let i = minIdx; i <= maxIdx; i++) {
        if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === i)) {
            state.selectedPointIndices.push({ objectId, pointIndex: i });
        }
    }
    
    state.selectedObjectId = objectId;
    state.selectedPointIndex = toIndex;
    
    if (!state.selectedObjectIds.includes(objectId)) {
        state.selectedObjectIds.push(objectId);
    }
    
    syncPointToEdgeSelection(objectId);
}

/**
 * Select an edge (with optional multi-select mode)
 */
function selectEdge(objectId, edgeIndex, addToSelection = false) {
    if (!addToSelection) {
        clearSelections();
    }
    
    const key = { objectId, edgeIndex };
    if (!state.selectedEdgeIndices.some(e => e.objectId === objectId && e.edgeIndex === edgeIndex)) {
        state.selectedEdgeIndices.push(key);
    }
    
    state.selectedObjectId = objectId;
    state.selectedEdgeIndex = edgeIndex;
    
    // Ensure the object is in selection
    if (!state.selectedObjectIds.includes(objectId)) {
        state.selectedObjectIds.push(objectId);
    }
    
    // When selecting an edge, select its points too
    const obj = state.objects.find(o => o.id === objectId);
    if (obj && obj.edges[edgeIndex]) {
        const edge = obj.edges[edgeIndex];
        edge.points.forEach(ptIdx => {
            if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === ptIdx)) {
                state.selectedPointIndices.push({ objectId, pointIndex: ptIdx });
            }
        });
    }
    
    // Check if all edges of the object are selected, then select the object
    syncEdgeToObjectSelection(objectId);
}

/**
 * Select a range of edges (for shift+click range selection)
 */
function selectEdgeRange(objectId, fromIndex, toIndex) {
    const obj = state.objects.find(o => o.id === objectId);
    if (!obj) return;
    
    const minIdx = Math.min(fromIndex, toIndex);
    const maxIdx = Math.max(fromIndex, toIndex);
    
    for (let i = minIdx; i <= maxIdx; i++) {
        if (!state.selectedEdgeIndices.some(e => e.objectId === objectId && e.edgeIndex === i)) {
            state.selectedEdgeIndices.push({ objectId, edgeIndex: i });
        }
        
        // Also select the edge's points
        const edge = obj.edges[i];
        if (edge) {
            edge.points.forEach(ptIdx => {
                if (!state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === ptIdx)) {
                    state.selectedPointIndices.push({ objectId, pointIndex: ptIdx });
                }
            });
        }
    }
    
    state.selectedObjectId = objectId;
    state.selectedEdgeIndex = toIndex;
    
    if (!state.selectedObjectIds.includes(objectId)) {
        state.selectedObjectIds.push(objectId);
    }
    
    syncEdgeToObjectSelection(objectId);
}

/**
 * Select all objects in the scene (Ctrl+A)
 */
function selectAllObjects() {
    clearSelections();
    state.objects.forEach(obj => {
        selectObject(obj.id, true);
    });
}

/**
 * Select all points and edges of the currently selected object (Shift+A)
 */
function selectAllPointsAndEdges() {
    if (!state.selectedObjectId) return;
    
    const obj = state.objects.find(o => o.id === state.selectedObjectId);
    if (!obj) return;
    
    // Select all points
    obj.points.forEach((_, i) => {
        if (!state.selectedPointIndices.some(p => p.objectId === obj.id && p.pointIndex === i)) {
            state.selectedPointIndices.push({ objectId: obj.id, pointIndex: i });
        }
    });
    
    // Select all edges
    obj.edges.forEach((_, i) => {
        if (!state.selectedEdgeIndices.some(e => e.objectId === obj.id && e.edgeIndex === i)) {
            state.selectedEdgeIndices.push({ objectId: obj.id, edgeIndex: i });
        }
    });
}

/**
 * Toggle selection of an object
 */
function toggleObjectSelection(objectId) {
    const idx = state.selectedObjectIds.indexOf(objectId);
    if (idx >= 0) {
        state.selectedObjectIds.splice(idx, 1);
        // Also remove related point and edge selections
        state.selectedPointIndices = state.selectedPointIndices.filter(p => p.objectId !== objectId);
        state.selectedEdgeIndices = state.selectedEdgeIndices.filter(e => e.objectId !== objectId);
        if (state.selectedObjectId === objectId) {
            state.selectedObjectId = state.selectedObjectIds[0] || null;
            state.selectedPointIndex = null;
            state.selectedEdgeIndex = null;
        }
    } else {
        selectObject(objectId, true);
    }
}

/**
 * Toggle selection of a point
 */
function togglePointSelection(objectId, pointIndex) {
    const idx = state.selectedPointIndices.findIndex(p => p.objectId === objectId && p.pointIndex === pointIndex);
    if (idx >= 0) {
        state.selectedPointIndices.splice(idx, 1);
        if (state.selectedPointIndex === pointIndex && state.selectedObjectId === objectId) {
            state.selectedPointIndex = state.selectedPointIndices[0]?.pointIndex || null;
        }
        // Deselect edges that have this point
        deselectEdgesWithPoint(objectId, pointIndex);
        // Re-sync edge selection
        syncPointToEdgeSelection(objectId);
    } else {
        selectPoint(objectId, pointIndex, true);
    }
}

/**
 * Deselect edges that have a specific point
 */
function deselectEdgesWithPoint(objectId, pointIndex) {
    const obj = state.objects.find(o => o.id === objectId);
    if (!obj) return;
    
    obj.edges.forEach((edge, edgeIndex) => {
        if (edge.points.includes(pointIndex)) {
            const edgeIdx = state.selectedEdgeIndices.findIndex(e => e.objectId === objectId && e.edgeIndex === edgeIndex);
            if (edgeIdx >= 0) {
                state.selectedEdgeIndices.splice(edgeIdx, 1);
            }
        }
    });
    
    // Check if object should be deselected (not all edges selected anymore)
    syncEdgeToObjectSelection(objectId);
}

/**
 * Toggle selection of an edge
 */
function toggleEdgeSelection(objectId, edgeIndex) {
    const idx = state.selectedEdgeIndices.findIndex(e => e.objectId === objectId && e.edgeIndex === edgeIndex);
    if (idx >= 0) {
        state.selectedEdgeIndices.splice(idx, 1);
        if (state.selectedEdgeIndex === edgeIndex && state.selectedObjectId === objectId) {
            state.selectedEdgeIndex = state.selectedEdgeIndices[0]?.edgeIndex || null;
        }
    } else {
        selectEdge(objectId, edgeIndex, true);
    }
}

/**
 * Sync: When two points of an edge are selected, select the edge
 */
function syncPointToEdgeSelection(objectId) {
    const obj = state.objects.find(o => o.id === objectId);
    if (!obj) return;
    
    obj.edges.forEach((edge, edgeIndex) => {
        const p0Selected = state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === edge.points[0]);
        const p1Selected = state.selectedPointIndices.some(p => p.objectId === objectId && p.pointIndex === edge.points[1]);
        
        if (p0Selected && p1Selected) {
            // Both points selected, select the edge
            if (!state.selectedEdgeIndices.some(e => e.objectId === objectId && e.edgeIndex === edgeIndex)) {
                state.selectedEdgeIndices.push({ objectId, edgeIndex: edgeIndex });
            }
        }
    });
    
    // Check if all edges are now selected
    syncEdgeToObjectSelection(objectId);
}

/**
 * Sync: When all edges of an object are selected, select the object
 */
function syncEdgeToObjectSelection(objectId) {
    const obj = state.objects.find(o => o.id === objectId);
    if (!obj) return;
    
    const allEdgesSelected = obj.edges.every((_, i) => 
        state.selectedEdgeIndices.some(e => e.objectId === objectId && e.edgeIndex === i)
    );
    
    if (allEdgesSelected && obj.edges.length > 0) {
        if (!state.selectedObjectIds.includes(objectId)) {
            state.selectedObjectIds.push(objectId);
        }
        state.selectedObjectId = objectId;
    }
}

/**
 * Select all objects within a selection box
 */
function selectInBox(box, addToSelection = false) {
    if (!addToSelection) {
        clearSelections();
    }
    
    state.objects.forEach(obj => {
        // Check if any point is within the box
        const pointsInBox = obj.points.filter(p => 
            p.x >= box.x && p.x <= box.x + box.width &&
            p.y >= box.y && p.y <= box.y + box.height
        );
        
        if (pointsInBox.length > 0) {
            // Select the object
            if (!state.selectedObjectIds.includes(obj.id)) {
                state.selectedObjectIds.push(obj.id);
            }
            
            // Select points within box
            pointsInBox.forEach(p => {
                const ptIdx = obj.points.indexOf(p);
                if (!state.selectedPointIndices.some(sel => sel.objectId === obj.id && sel.pointIndex === ptIdx)) {
                    state.selectedPointIndices.push({ objectId: obj.id, pointIndex: ptIdx });
                }
            });
            
            // Select edges that are fully within the box
            obj.edges.forEach((edge, i) => {
                const p1 = obj.points[edge.points[0]];
                const p2 = obj.points[edge.points[1]];
                const p1InBox = p1.x >= box.x && p1.x <= box.x + box.width && p1.y >= box.y && p1.y <= box.y + box.height;
                const p2InBox = p2.x >= box.x && p2.x <= box.x + box.width && p2.y >= box.y && p2.y <= box.y + box.height;
                
                if (p1InBox && p2InBox) {
                    if (!state.selectedEdgeIndices.some(e => e.objectId === obj.id && e.edgeIndex === i)) {
                        state.selectedEdgeIndices.push({ objectId: obj.id, edgeIndex: i });
                    }
                }
            });
        }
    });
    
    // Sync selections
    state.selectedObjectIds.forEach(id => {
        syncPointToEdgeSelection(id);
        syncEdgeToObjectSelection(id);
    });
    
    // Set primary selection
    if (state.selectedObjectIds.length > 0) {
        state.selectedObjectId = state.selectedObjectIds[0];
    }
}

// ============================================
// HIT TESTING
// ============================================

function distToSegment(p, a, b) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ap = { x: p.x - a.x, y: p.y - a.y };
    const proj = (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1);
    const t = clamp(proj, 0, 1);
    return dist(p, { x: a.x + t * ab.x, y: a.y + t * ab.y });
}

function hitTestObject(pos) {
    for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        const bbox = getTransformedBoundingBox(obj);
        if (pos.x >= bbox.x - 5 && pos.x <= bbox.x + bbox.width + 5 &&
            pos.y >= bbox.y - 5 && pos.y <= bbox.y + bbox.height + 5) {
            return obj;
        }
    }
    return null;
}

function hitTestEdge(pos, obj) {
    if (!obj) return null;
    for (let i = 0; i < obj.edges.length; i++) {
        const edge = obj.edges[i];
        const p1 = obj.points[edge.points[0]];
        const p2 = obj.points[edge.points[1]];
        if (distToSegment(pos, p1, p2) < 10) return i;
    }
    return null;
}

function hitTestHandle(pos, bbox) {
    const handles = {
        'nw': { x: bbox.x, y: bbox.y }, 'n': { x: bbox.x + bbox.width/2, y: bbox.y },
        'ne': { x: bbox.x + bbox.width, y: bbox.y }, 'e': { x: bbox.x + bbox.width, y: bbox.y + bbox.height/2 },
        'se': { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, 's': { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height },
        'sw': { x: bbox.x, y: bbox.y + bbox.height }, 'w': { x: bbox.x, y: bbox.y + bbox.height/2 }
    };
    for (const [name, h] of Object.entries(handles)) {
        if (dist(pos, h) < 10) return name;
    }
    return null;
}

function hitTestPoint(pos, obj) {
    if (!obj) return null;
    for (let i = 0; i < obj.points.length; i++) {
        if (dist(pos, obj.points[i]) < 10) return i;
    }
    return null;
}

// ============================================
// OBJECT CREATION
// ============================================

function createRectangle(x, y, w, h) {
    const id = generateId();
    return {
        id, type: 'rectangle', name: 'Rectangle',
        points: [{x,y}, {x:x+w,y}, {x:x+w,y:y+h}, {x,y:y+h}],
        edges: [ {points:[0,1]}, {points:[1,2]}, {points:[2,3]}, {points:[3,0]} ],
        fill: state.fillColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth,
        closed: true
    };
}

function createCircle(cx, cy, r) {
    const id = generateId();
    r = Math.max(1, r);
    return {
        id, type: 'circle', name: 'Circle',
        center: {x: cx, y: cy}, radius: r,
        points: [
            {x:cx, y:cy-r}, {x:cx+r, y:cy},
            {x:cx, y:cy+r}, {x:cx-r, y:cy}
        ],
        edges: [
            {points:[0, 2], type: 'arc', rx: r, ry: r, rotation: 0, largeArc: 0, sweep: 1},
            {points:[2, 0], type: 'arc', rx: r, ry: r, rotation: 0, largeArc: 0, sweep: 1}
        ],
        fill: state.fillColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth,
        closed: true
    };
}

function createPolygon(cx, cy, r, sides) {
    const id = generateId();
    const pts = [];
    const edges = [];
    const step = (2 * Math.PI) / sides;
    for(let i=0; i<sides; i++) {
        pts.push({ x: cx + r * Math.cos(-Math.PI/2 + i*step), y: cy + r * Math.sin(-Math.PI/2 + i*step) });
    }
    for(let i=0; i<sides; i++) edges.push({ points: [i, (i+1)%sides] });
    
    return { 
        id, type: 'polygon', name: 'Polygon', 
        points: pts, edges, sides, 
        center: {x: cx, y: cy}, radius: r,
        fill: state.fillColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth,
        closed: true
    };
}

// ============================================
// EXPORTS
// ============================================

window.VectorEditor = {
    state,
    generateId,
    getMousePos,
    clamp,
    dist,
    getBoundingBox,
    getTransformedBoundingBox,
    getArcParamsFromAngle,
    getArcCurveCommand,
    distToSegment,
    hitTestObject,
    hitTestEdge,
    hitTestHandle,
    hitTestPoint,
    createRectangle,
    createCircle,
    createPolygon,
    // Selection management
    clearSelections,
    isObjectSelected,
    isPointSelected,
    isEdgeSelected,
    selectObject,
    selectPoint,
    selectPointRange,
    selectEdge,
    selectEdgeRange,
    toggleObjectSelection,
    togglePointSelection,
    toggleEdgeSelection,
    syncPointToEdgeSelection,
    syncEdgeToObjectSelection,
    deselectEdgesWithPoint,
    selectInBox,
    selectAllObjects,
    selectAllPointsAndEdges
};
