import { loadContent } from './data.js';

const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const svg = document.getElementById('connections');

const breadcrumb = document.getElementById('breadcrumb');
const infoTitle = document.getElementById('infoTitle');
const infoDesc = document.getElementById('infoDesc');
const papersSection = document.getElementById('papersSection');
const papersList = document.getElementById('papersList');
const childrenSection = document.getElementById('childrenSection');
const childrenList = document.getElementById('childrenList');
// Removed references to goParentBtn and goRootBtn

let root = null;
let current = null;
let parentStack = []; // stack of ancestor nodes
let tx = 0, ty = 0, scale = 1;
let TRANS_MS = 520;

// New state for handling persistent selection
let currentInfoNode = null; // Track which node's info is currently displayed for hover/click
let selectedFinalNodeData = null; // NEW: Tracks the data of the explicitly clicked final node.
let selectedFinalNodeEl = null; // Track the DOM element of a non-navigational click for highlighting

// world/canvas size (fixed, nodes positioned in world coords)
const WORLD = { width: 3000, height: 2000 };
// Calculate world center for convenience
const WORLD_CENTER_X = WORLD.width / 2;
const WORLD_CENTER_Y = WORLD.height / 2;

canvas.style.width = WORLD.width + 'px';
canvas.style.height = WORLD.height + 'px';
svg.setAttribute('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`);
svg.style.width = WORLD.width + 'px';
svg.style.height = WORLD.height + 'px';

// utilities
function clearView() {
    canvas.innerHTML = '';
    while (svg.firstChild) svg.removeChild(svg.firstChild);
}
function applyTransform() {
    viewport.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function createNodeElement(id, label, x, y, cls = '', nodeData = null) {
    const el = document.createElement('div');
    el.className = `node ${cls}`.trim();
    el.textContent = label;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    canvas.appendChild(el);
    el.dataset.worldX = x;
    el.dataset.worldY = y;
    el.dataset.nodeId = id;
    // Attach hover events if nodeData is provided and it's not the central active node
    if (nodeData && id !== 'current') {
        el.addEventListener('mouseenter', () => handleNodeHover(nodeData));
        el.addEventListener('mouseleave', () => handleNodeLeave());
    }

    return el;
}

function drawLine(x1,y1,x2,y2, stroke='rgba(255,255,255,0.25)', width=2){
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
}

// compute radial layout around center
function layoutChildren(centerX, centerY, children, radiusBase=300) {
    const n = children.length;
    const out = [];
    const radius = radiusBase;
    for (let i=0;i<n;i++){
        // Calculates angle and position for each item, distributing them evenly in a circle.
        const angle = (2*Math.PI*i)/n - Math.PI/2;
        const x = Math.round(centerX + radius * Math.cos(angle));
        const y = Math.round(centerY + radius * Math.sin(angle));
        out.push({node: children[i], x, y});
    }
    return out;
}

// --- Hover Logic ---
function handleNodeHover(node) {
    // If a final node is already selected, hovering over a new node should NOT override the panel.
    if (selectedFinalNodeData) return;

    // Update the panel only if the node is different from the one currently shown
    if (currentInfoNode !== node) {
        updateInfoPanel(node);
        currentInfoNode = node;
    }
}

function handleNodeLeave() {
    // If a final node is explicitly selected, the panel stays on that data. Do nothing.
    if (selectedFinalNodeData) return;

    // Otherwise, revert the panel to display the currently active central node.
    if (currentInfoNode !== current) {
        updateInfoPanel(current);
        currentInfoNode = current;
    }
}
// --- End Hover Logic ---


/**
* Handles the logic for clicking on a final node (no children).
* Updates the info panel and highlights the node visually.
* @param {object} node - The final node data object.
* @param {HTMLElement} el - The DOM element of the clicked node.
*/
function handleFinalNodeClick(node, el) {
    // 1. Clear previous selection visually and data-wise
    if (selectedFinalNodeEl) {
        selectedFinalNodeEl.classList.remove('selected-final');
    }

    // 2. Update state and Panel
    currentInfoNode = node; // For hover logic to temporarily match
    selectedFinalNodeData = node; // NEW: Set the persistent selection state
    updateInfoPanel(node);

    // 3. Visual Feedback
    // Apply new selection highlight
    if (el) {
        el.classList.add('selected-final');
        selectedFinalNodeEl = el;
    }
}


// update right-hand panel for node
function updateInfoPanel(node) {
    infoTitle.textContent = node.name || 'Untitled';
    infoDesc.textContent = node.description || 'No description provided.';
    infoDesc.classList.add("description");
    breadcrumb.innerHTML = renderBreadcrumbs(); // Renders the updated, now clickable, breadcrumbs

    // papers
    papersList.innerHTML = '';
    if (node.papers && node.papers.length>0) {
        papersSection.style.display = 'block';
        node.papers.forEach(p=>{
            const el = document.createElement('div');
            el.className = 'paper-item';
            el.innerHTML = `<div style="font-weight:700">${p.title || 'Untitled'}</div>
            <div style="font-size:13px;color:#718096;margin:6px 0">${p.authors || ''}</div>
            <div style="font-size:13px;color:#4a5568">${p.summary || ''}</div>
            <div style="margin-top:8px"><a href="${p.url||'#'}" target="_blank">${p.url? 'Open paper' : ''}</a></div>`;
            papersList.appendChild(el);
        });
    } else {
        papersSection.style.display = 'none';
    }

    // Removed goParentBtn and goRootBtn disabling logic
}

/**
 * Breadcrumb builder.
 * Ancestor nodes are clickable <a> tags that navigate up the hierarchy.
 */
function renderBreadcrumbs(){
  // Map parentStack (ancestors) to clickable links
  // i is the index in the parentStack
  const parts = parentStack.map((n, i) => {
      const a = document.createElement('a');
      a.href = 'javascript:void(0);'; 
      a.textContent = n.name;
      // PASS THE INDEX (i) INSTEAD OF THE NODE OBJECT
      a.onclick = () => goToNodeFromBreadcrumb(i); 
      
      a.style.color = '#667eea'; 
      return a.outerHTML;
  }).concat(current ? [`<strong>${current.name}</strong>`] : []); // Current node is bolded text
  
  return parts.join(' › ');
}

/**
* Function to navigate to an ancestor node clicked in the breadcrumb trail.
* @param {number} targetIndex - The index of the node in the parentStack to navigate to.
*/
function goToNodeFromBreadcrumb(targetIndex) {
  let newCurrent;

  // 1. Determine the new current node and update the stack
  // The target node is the one at the targetIndex
  newCurrent = parentStack[targetIndex];
  // Pop all nodes that came after the target node (index + 1)
  parentStack.splice(targetIndex + 1);
  
  // If we clicked the currently active node in the breadcrumb (shouldn't happen 
  // since it's bolded, but good for safety)
  if (newCurrent === current) return; 

  current = newCurrent;

  // 2. Navigation and Rendering logic (non-zooming)
  const newTargetScale = 1.0; 

  // Clear selection state on navigation UP
  if (selectedFinalNodeEl) selectedFinalNodeEl.classList.remove('selected-final');
  selectedFinalNodeData = null; 

  // Smoothly zoom/recenter to the fixed world center at the fixed scale
  smoothZoomTo(WORLD_CENTER_X, WORLD_CENTER_Y, newTargetScale, true).then(() => {
      viewport.style.transition = '';
      renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);
      void viewport.offsetWidth;
  });
}


/**
* Renders the current level's mind map.
* @param {number} [centerX=WORLD.width/2] - The world X coordinate where the new central node should be placed.
* @param {number} [centerY=WORLD.height/2] - The world Y coordinate where the new central node should be placed.
*/
function renderLevel(centerX = WORLD_CENTER_X, centerY = WORLD_CENTER_Y) {
    clearView();
    // Use the passed-in coordinates as the center point for the radial layout
    const center = { x: centerX, y: centerY };

    // 1. Center Node (The "anchor" of the current view)
    const curEl = createNodeElement('current', current.name, center.x, center.y, 'category active');
    curEl.onclick = () => {
        // clicking current does nothing (stays)
    };
    // Initialize currentInfoNode so that the panel shows the central node's info initially
    currentInfoNode = current;

    // 2. Prepare items for radial layout
    let itemsToLayout = [];
    // Add Parent node if stack is not empty (This node will be positioned in the circle)
    if (parentStack.length > 0) {
        const parent = parentStack[parentStack.length - 1];
        // We add metadata (type) to distinguish it later
        itemsToLayout.push({ node: parent, type: 'prev-level' });
    }

    // Add all Children nodes
    if (current.children && current.children.length > 0) {
        current.children.forEach(c => {
            // We add metadata (type) to distinguish it later
            itemsToLayout.push({ node: c, type: 'child' });
        });
    }

    // 3. Arrange items radially around the central current node
    if (itemsToLayout.length > 0) {
        // The radius is set to 300 for a good circular spread.
        const arranged = layoutChildren(center.x, center.y, itemsToLayout, 300);

        arranged.forEach((entry, idx) => {
            const nodeData = entry.node;
            const type = nodeData.type; // Extract the type we set

            if (type === 'prev-level') {
                // This is the parent node, creating it as 'prev-level'. Pass the actual node data.
                const prevEl = createNodeElement('prev', nodeData.node.name, entry.x, entry.y, 'prev-level', nodeData.node);
                prevEl.onclick = () => {
                    // Go up logic
                    // Clear selection state on navigation UP
                    if (selectedFinalNodeEl) selectedFinalNodeEl.classList.remove('selected-final');
                    selectedFinalNodeData = null; // Clear persistent selection
                    
                    current = nodeData.node;
                    parentStack.pop();
                    const newTargetScale = 1.0; 

                    // FIX: Zoom to the absolute world center at the new scale
                    smoothZoomTo(WORLD_CENTER_X, WORLD_CENTER_Y, newTargetScale, true).then(()=> {
                        viewport.style.transition = '';
                        // Render the new map, centered at the fixed world center.
                        renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);
                        void viewport.offsetWidth;
                    });
                };
                // Draw line from center node to parent
                drawLine(center.x, center.y, entry.x, entry.y);
            }
            else if (type === 'child') {
                const nodeId = nodeData.node.id || nodeData.node.name; // Use name as reliable ID
                // This is a child node, creating it as a standard 'node'. Pass the actual node data.
                let cls = 'node';
                // Re-apply highlight if this element is the persistently selected one
                if (selectedFinalNodeData && selectedFinalNodeData.name === nodeData.node.name) {
                    cls += ' selected-final';
                }

                const el = createNodeElement(nodeId, nodeData.node.name, entry.x, entry.y, cls, nodeData.node);

                el.onclick = () => {
                    // Pass world coordinates and element. These coords are still relevant for the *zoom target*.
                    enterChild(nodeData.node, entry.x, entry.y, el); 
                };
                // Draw line from center node to child
                drawLine(center.x, center.y, entry.x, entry.y);
            }
        });
    }
    // If a final node is selected, keep its info displayed. Otherwise, show current node info.
    if (selectedFinalNodeData) {
        updateInfoPanel(selectedFinalNodeData);
    } else {
        updateInfoPanel(current);
    }
}

// enter child: push current to stack, set current=child, zoom to child's world coords then render
function enterChild(childNode, childX=null, childY=null, childEl=null){ // Accept world coords and childEl
    // NEW LOGIC: If it's a final node (no children), select it but don't navigate/zoom
    if (!childNode.children || childNode.children.length === 0) {
        handleFinalNodeClick(childNode, childEl); // Pass element
        return;
    }
    // Clear any visual highlight and persistent selection state on navigation DOWN
    if (selectedFinalNodeEl) {
        selectedFinalNodeEl.classList.remove('selected-final');
        selectedFinalNodeEl = null;
    }
    selectedFinalNodeData = null; // Clear persistent selection

    parentStack.push(current);
    current = childNode;

    // target zoom scale is fixed at 1.0
    const targetScale = 1.0; 

    const worldCenter = { x: WORLD_CENTER_X, y: WORLD_CENTER_Y };
    // The coordinates of the clicked node in the current view
    const oldNodeX = childX || worldCenter.x;
    const oldNodeY = childY || worldCenter.y;

    // 1. Smoothly transition the viewport so the clicked node moves to the screen center.
    smoothZoomTo(oldNodeX, oldNodeY, targetScale).then(()=>{
        
        // 2. Snap the viewport translation (tx, ty) so that the fixed world center
        //    (where the new map will be drawn) is aligned with the screen center.
        tx = (window.innerWidth / 2) - (WORLD_CENTER_X * targetScale);
        ty = (window.innerHeight / 2) - (WORLD_CENTER_Y * targetScale);
        applyTransform();
        
        viewport.style.transition = '';
        // 3. Render the new map, centered at the **fixed world center**.
        renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);

        // FIX: Force a DOM reflow to ensure the browser draws the new SVG lines.
        void viewport.offsetWidth;
    });
}

/**
 * smooth zoom helper: center world coordinate (wx,wy) to screen center at targetScale
 * @param {number} wx - The world X coordinate to center on the screen.
 * @param {number} wy - The world Y coordinate to center on the screen.
 * @param {number} targetScale - The scale to transition to.
 * @param {boolean} [recenter=false] - If true, calculates the transform to center the WORLD center.
 */
function smoothZoomTo(wx, wy, targetScale=1.0, recenter = false){
    return new Promise(resolve=>{
        const screenCenterX = window.innerWidth/2;
        const screenCenterY = window.innerHeight/2;
        
        let newTx;
        let newTy;

        if (recenter) {
            // Recenter: Calculate transform for world center (WORLD_CENTER_X, WORLD_CENTER_Y) 
            // to be at screen center at the targetScale.
            newTx = screenCenterX - WORLD_CENTER_X * targetScale;
            newTy = screenCenterY - WORLD_CENTER_Y * targetScale;
        } else {
            // Zoom-in: Calculate transform needed to center the world point (wx, wy) on the screen.
            newTx = screenCenterX - wx * targetScale;
            newTy = screenCenterY - wy * targetScale;
        }


        viewport.style.transition = `transform ${TRANS_MS}ms cubic-bezier(.22,.9,.32,1)`;
        tx = newTx; ty = newTy; scale = targetScale;
        applyTransform();

        setTimeout(()=>{
            resolve();
        }, TRANS_MS + 10);
    });
}


// basic panning (drag stage when clicking empty area)
let isPanning=false, panStart=null;
stage.addEventListener('mousedown', (e)=>{
    // don't pan when clicking a node or info panel
    if (e.target.closest('.node') || e.target.closest('.info-panel')) return;
    isPanning = true;
    panStart = {x: e.clientX, y: e.clientY, tx, ty};
});
window.addEventListener('mousemove',(e)=>{
    if(!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    tx = panStart.tx + dx;
    ty = panStart.ty + dy;
    applyTransform();
});
window.addEventListener('mouseup', ()=> { isPanning=false; panStart=null; });

// touch support (basic)
stage.addEventListener('touchstart',(ev)=>{
    if(ev.touches.length===1 && !ev.target.closest('.node')) {
        const t = ev.touches[0];
        isPanning=true; panStart={x:t.clientX,y:t.clientY,tx,ty};
    }
});
stage.addEventListener('touchmove',(ev)=>{
    if(!isPanning) return;
    const t = ev.touches[0];
    tx = panStart.tx + (t.clientX - panStart.x);
    ty = panStart.ty + (t.clientY - panStart.y);
    applyTransform();
});
window.addEventListener('touchend',()=>{ isPanning=false; panStart=null; });

// initial load
(async function init(){
    try {
        // ... (removed config/firebase boilerplate for brevity, keeping only load/init)

        root = await loadContent();
        // default current is root
        current = root;
        // center viewport initially on world center
        tx = (window.innerWidth/2) - (WORLD_CENTER_X); // Use defined world center
        ty = (window.innerHeight/2) - (WORLD_CENTER_Y); // Use defined world center
        scale = 1.0;
        applyTransform();
        // Initial render uses the fixed WORLD center
        renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);
    } catch (err) {
        infoTitle.textContent = 'Error loading content';
        infoDesc.textContent = err.message;
        console.error(err);
    }
})();