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
const sitesSection = document.getElementById('sitesSection');
const sitesList = document.getElementById('sitesList');
const vertical_offset = 0;

let root = null;
let current = null;
let parentStack = []; 
let tx = 0, ty = 0, scale = 1;
const TRANS_MS = 520;

let currentInfoNode = null; 
let selectedFinalNodeData = null; 
let selectedFinalNodeEl = null; 

const WORLD = { width: 3000, height: 2000 };
const WORLD_CENTER_X = WORLD.width / 2;
const WORLD_CENTER_Y = WORLD.height / 2;
const ACCENT_COLOR = "#1F8BFF";   // pick any colour you want

const INFO_PANEL_WIDTH = 350; // Estimate the pixel width of your right info panel.


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

function layoutChildren(centerX, centerY, children, radiusBase=300) {
    const n = children.length;
    const out = [];
    const radius = radiusBase;
    for (let i=0;i<n;i++){
        const angle = (2*Math.PI*i)/n - Math.PI/2;
        const x = Math.round(centerX + radius * Math.cos(angle));
        const y = Math.round(centerY + radius * Math.sin(angle));
        out.push({node: children[i], x, y});
    }
    return out;
}

// --- Hover/Click Logic ---
function handleNodeHover(node) {
    if (selectedFinalNodeData) return;
    if (currentInfoNode !== node) {
        updateInfoPanel(node);
        currentInfoNode = node;
    }
}

function handleNodeLeave() {
    if (selectedFinalNodeData) return;
    if (currentInfoNode !== current) {
        updateInfoPanel(current);
        currentInfoNode = current;
    }
}

function handleFinalNodeClick(node, el) {
    if (selectedFinalNodeEl) {
        selectedFinalNodeEl.classList.remove('selected-final');
    }

    currentInfoNode = node; 
    selectedFinalNodeData = node; 
    updateInfoPanel(node);

    if (el) {
        el.classList.add('selected-final');
        selectedFinalNodeEl = el;
    }
}


function updateInfoPanel(node) {
    if (!node) return; // Safety check
    
    infoTitle.textContent = node.name || 'Untitled';
    infoDesc.textContent = node.description || 'No description provided.';
    infoDesc.classList.add("description");
    breadcrumb.innerHTML = renderBreadcrumbs();

    // ---- SITES ----
    sitesList.innerHTML = '';
if (node.sites && node.sites.length > 0) {
    sitesSection.style.display = 'block';
    node.sites.forEach(s => {
        const el = document.createElement('div');
        el.className = 'site-item';
        el.innerHTML = `
            <div style="font-weight:700">
                <a href="${s.url || '#'}" target="_blank" 
                   style="color:${ACCENT_COLOR}; text-decoration:none;">
                    ${s.title || 'Untitled'}
                </a>
            </div>
            <div style="font-size:13px;color:#4a5568;margin:6px 0">
                ${s.summary || ''}
            </div>
        `;
        sitesList.appendChild(el);
    });
} else {
    sitesSection.style.display = 'none';
}

    // ---- PAPERS ----
    papersList.innerHTML = '';
    if (node.papers && node.papers.length > 0) {
        papersSection.style.display = 'block';
        node.papers.forEach(p => {
            const el = document.createElement('div');
            el.className = 'paper-item';
            el.innerHTML = `
                <div style="font-weight:700">${p.title || 'Untitled'}</div>
    
                <div style="font-size:13px;color:#718096;margin:6px 0">
                    ${p.authors || ''}
                    ${p.year ? ` (${p.year})` : ''}
                </div>
    
                <div style="font-size:13px;color:#4a5568">${p.summary || ''}</div>
    
                <div style="margin-top:8px">
                    <a href="${p.url || '#'}" target="_blank">${p.url ? 'Open paper' : ''}</a>
                </div>
            `;
            papersList.appendChild(el);
        });
    } else {
        papersSection.style.display = 'none';
    }
}


/**
 * Breadcrumb builder. Ancestor nodes are clickable links.
 */
function renderBreadcrumbs(){
    // i is the index in the parentStack
    const parts = parentStack.map((n, i) => {
        const a = document.createElement('a');
        a.href = `javascript:goToNodeFromBreadcrumb(${i});`; 
        a.textContent = n.name;
        a.style.color = '#667eea'; 
        return a.outerHTML;
    }).concat(current ? [`<strong>${current.name}</strong>`] : []); 
    
    return parts.join(' › ');
}

/**
* Function to navigate to an ancestor node clicked in the breadcrumb trail.
* @param {number} targetIndex - The index of the node in the parentStack to navigate to.
*/
// Make this function global so javascript: href can access it
window.goToNodeFromBreadcrumb = function(targetIndex) {
  let newCurrent;

  // 1. Determine the new current node and update the stack
  newCurrent = parentStack[targetIndex];
  // Remove the target node and everything after it from the stack
  // The target becomes the new current, so it shouldn't be in parentStack
  parentStack.splice(targetIndex);
  
  if (newCurrent === current) return; 

  current = newCurrent;

  // 2. Navigation and Rendering logic
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
* Renders the current level's mind map with depth-based coloring.
*/
function renderLevel(centerX = WORLD_CENTER_X, centerY = WORLD_CENTER_Y) {
    clearView();
    const center = { x: centerX, y: centerY };

    // CALCULATE ABSOLUTE DEPTH OF THE CURRENT NODE (Root = 0)
    const currentDepth = parentStack.length;
    const currentDepthClass = `depth-${currentDepth}`; 

    // 1. Center Node: Applies the 'active' class (for size/padding) and its depth class (for color)
    const curEl = createNodeElement('current', current.name, center.x, center.y, `active ${currentDepthClass}`); 
    
    // Clicking the center node keeps the view and info panel as is (no action).
    curEl.onclick = () => {};

    currentInfoNode = current;

    // 2. Prepare items for radial layout
    let itemsToLayout = [];
    if (parentStack.length > 0) {
        const parent = parentStack[parentStack.length - 1];
        itemsToLayout.push({ node: parent, type: 'prev-level' });
    }

    if (current.children && current.children.length > 0) {
        current.children.forEach(c => {
            itemsToLayout.push({ node: c, type: 'child' });
        });
    }

    // 3. Arrange items radially
    if (itemsToLayout.length > 0) {
        const arranged = layoutChildren(center.x, center.y, itemsToLayout, 300);

        arranged.forEach((entry, idx) => {
            const nodeData = entry.node;
            const type = nodeData.type;

            if (type === 'prev-level') {
                // Parent node is at currentDepth - 1
                const parentDepthClass = `depth-${currentDepth - 1}`;
                
                // Applies .prev-level (for styling) and its depth class (for color)
                const prevEl = createNodeElement('prev', nodeData.node.name, entry.x, entry.y, `prev-level ${parentDepthClass}`, nodeData.node);
                
                // *** FIX: Add the onclick handler for navigating UP ***
                prevEl.onclick = () => {
                    if (selectedFinalNodeEl) selectedFinalNodeEl.classList.remove('selected-final');
                    selectedFinalNodeData = null; 
                    
                    current = nodeData.node;
                    parentStack.pop();
                    const newTargetScale = 1.0; 

                    smoothZoomTo(WORLD_CENTER_X, WORLD_CENTER_Y, newTargetScale, true).then(()=> {
                        viewport.style.transition = '';
                        renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);
                        void viewport.offsetWidth;
                    });
                };
                drawLine(center.x, center.y, entry.x, entry.y);
            }
            else if (type === 'child') {
                const nodeId = nodeData.node.id || nodeData.node.name; 
                
                // Child node is at currentDepth + 1
                const childDepthClass = `depth-${currentDepth + 1}`;
                let cls = childDepthClass;
                
                if (selectedFinalNodeData && selectedFinalNodeData.name === nodeData.node.name) {
                    cls += ' selected-final';
                }

                const el = createNodeElement(nodeId, nodeData.node.name, entry.x, entry.y, cls, nodeData.node);

                // *** FIX: Add the onclick handler for navigating DOWN (zooming in) ***
                el.onclick = () => {
                    enterChild(nodeData.node, entry.x, entry.y, el); 
                };
                drawLine(center.x, center.y, entry.x, entry.y);
            }
        });
    }
    
    if (selectedFinalNodeData) {
        updateInfoPanel(selectedFinalNodeData);
    } else {
        updateInfoPanel(current);
    }
}

function enterChild(childNode, childX=null, childY=null, childEl=null){ 
    if (!childNode.children || childNode.children.length === 0) {
        handleFinalNodeClick(childNode, childEl); 
        return;
    }

    if (selectedFinalNodeEl) {
        selectedFinalNodeEl.classList.remove('selected-final');
        selectedFinalNodeEl = null;
    }
    selectedFinalNodeData = null; 

    parentStack.push(current);
    current = childNode;

    const targetScale = 1.0; 
    const worldCenter = { x: WORLD_CENTER_X, y: WORLD_CENTER_Y };
    const oldNodeX = childX || worldCenter.x;
    const oldNodeY = childY || worldCenter.y;

    smoothZoomTo(oldNodeX, oldNodeY, targetScale).then(()=>{
        
        // --- MODIFIED POST-ZOOM TRANSFORMATION ---
        const effectiveScreenWidth = window.innerWidth - INFO_PANEL_WIDTH;
        const targetScreenCenterX = effectiveScreenWidth / 2;

        tx = targetScreenCenterX - (WORLD_CENTER_X * targetScale);
        ty = (window.innerHeight / 2) - (WORLD_CENTER_Y * targetScale) + vertical_offset;
        applyTransform();
        // ------------------------------------------
        
        viewport.style.transition = '';
        renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);

        void viewport.offsetWidth;
    });
}

function smoothZoomTo(wx, wy, targetScale=1.0, recenter = false){
    return new Promise(resolve=>{
        const screenCenterY = window.innerHeight/2;
        
        // Use the center of the EFFECTIVE viewport (excluding the info panel)
        const effectiveScreenWidth = window.innerWidth - INFO_PANEL_WIDTH;
        const targetScreenCenterX = effectiveScreenWidth / 2;

        let newTx;
        let newTy;

        if (recenter) {
            // When recentering (e.g., navigating up a level), snap WORLD_CENTER_X to the targetScreenCenterX
            newTx = targetScreenCenterX - WORLD_CENTER_X * targetScale;
            newTy = screenCenterY - WORLD_CENTER_Y * targetScale + vertical_offset;
        } else {
            // When zooming onto a specific child node, center the child node (wx) in the target screen center
            newTx = targetScreenCenterX - wx * targetScale;
            newTy = screenCenterY - wy * targetScale + vertical_offset;
        }


        viewport.style.transition = `transform ${TRANS_MS}ms cubic-bezier(.22,.9,.32,1)`;
        tx = newTx; ty = newTy; scale = targetScale;
        applyTransform();

        setTimeout(()=>{
            resolve();
        }, TRANS_MS + 10);
    });
}


// basic panning 
let isPanning=false, panStart=null;
stage.addEventListener('mousedown', (e)=>{
    if (e.target.closest('.node') || e.target.closest('.info-panel') || e.target.closest('#backButton') || e.target.closest('.breadcrumb')) return;
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
    if(ev.touches.length===1 && !ev.target.closest('.node') && !ev.target.closest('.info-panel') && !ev.target.closest('#backButton') && !ev.target.closest('.breadcrumb')) {
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
        root = await loadContent();
        
        if (!root || !root.name) {
            throw new Error('Invalid content structure - missing name property');
        }
        
        current = root;
        currentInfoNode = current;
        
        // --- MODIFIED INITIAL TRANSFORMATION ---
        const effectiveScreenWidth = window.innerWidth - INFO_PANEL_WIDTH;
        const targetScreenCenterX = effectiveScreenWidth / 2;
        tx = targetScreenCenterX - WORLD_CENTER_X;
        ty = (window.innerHeight/2) - (WORLD_CENTER_Y) + vertical_offset;
        scale = 1.0;
        applyTransform();
        renderLevel(WORLD_CENTER_X, WORLD_CENTER_Y);
    } catch (err) {
        const infoTitle = document.getElementById('infoTitle');
        const infoDesc = document.getElementById('infoDesc');
        breadcrumb.textContent = 'Error';
        infoTitle.textContent = 'Error loading content';
        infoDesc.textContent = err.message;
        console.error('Init error:', err);
    }
})();