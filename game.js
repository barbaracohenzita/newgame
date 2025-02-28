// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state variables
let score = 0;
let roads = []; // Array to store drawn road segments

// Nodes: fixed start and destination positions
const start = { x: 80, y: 80 };
const dest = { x: canvas.width - 80, y: canvas.height - 80 };

// Car object with current position and path-following properties
const car = {
  x: start.x,
  y: start.y,
  speed: 2,
  path: null,        // Array of nodes (points) forming the route
  segIndex: 0,       // Current segment index in the path
  progress: 0        // Progress (0 to 1) along the current segment
};

// Variables for drawing roads with the mouse
let isDrawing = false;
let drawStart = { x: 0, y: 0 };
let mousePos = { x: 0, y: 0 };

// Threshold for snapping endpoints (in pixels)
const SNAP_THRESHOLD = 10;

// --- Utility Functions ---

// Draw a grid on the canvas
function drawGrid() {
  const gridSize = 20;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// --- Graph Building and Path Finding ---

// Build a graph from the start, destination, and all road endpoints.
// Nodes that are very close are merged.
function buildGraph() {
  let nodes = [];
  let adj = {}; // adjacency list: key = node id, value = array of neighbor ids
  
  // Helper: get or create a node (merging if within threshold)
  function getOrCreateNode(x, y) {
    for (let node of nodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (Math.hypot(dx, dy) < SNAP_THRESHOLD) {
        return node;
      }
    }
    const newNode = { id: nodes.length, x, y };
    nodes.push(newNode);
    adj[newNode.id] = [];
    return newNode;
  }

  // Add start and destination nodes
  const startNode = getOrCreateNode(start.x, start.y);
  const destNode = getOrCreateNode(dest.x, dest.y);

  // Add nodes and edges for each road
  roads.forEach(road => {
    const nodeA = getOrCreateNode(road.x1, road.y1);
    const nodeB = getOrCreateNode(road.x2, road.y2);
    const distance = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
    // Add bidirectional edges
    adj[nodeA.id].push({ id: nodeB.id, dist: distance });
    adj[nodeB.id].push({ id: nodeA.id, dist: distance });
  });

  return { nodes, adj, startNode, destNode };
}

// Use BFS to find a path from start to destination in the graph.
function findPath(graph) {
  const { nodes, adj, startNode, destNode } = graph;
  let queue = [startNode.id];
  let cameFrom = {};
  cameFrom[startNode.id] = null;

  while (queue.length) {
    let current = queue.shift();
    if (current === destNode.id) {
      // Reconstruct path as an array of node objects
      let path = [];
      while (current !== null) {
        const node = nodes.find(n => n.id === current);
        path.unshift(node);
        current = cameFrom[current];
      }
      return path;
    }
    for (let neighbor of adj[current]) {
      if (!(neighbor.id in cameFrom)) {
        cameFrom[neighbor.id] = current;
        queue.push(neighbor.id);
      }
    }
  }
  return null;
}

// --- Car Movement ---

function updateCar() {
  // Rebuild the graph and compute path every frame
  const graph = buildGraph();
  const path = findPath(graph);
  car.path = path;

  if (car.path && car.path.length > 1) {
    // Current segment: from node at segIndex to segIndex+1
    const currentNode = car.path[car.segIndex];
    const nextNode = car.path[car.segIndex + 1];
    const dx = nextNode.x - currentNode.x;
    const dy = nextNode.y - currentNode.y;
    const segLength = Math.hypot(dx, dy);

    // Increment progress along the segment based on speed
    car.progress += car.speed / segLength;
    if (car.progress >= 1) {
      // Move to the next segment
      car.segIndex++;
      car.progress = 0;
      // If reached destination, reset the car and increase score
      if (car.segIndex >= car.path.length - 1) {
        score++;
        resetCar();
        return;
      }
    }
    // Interpolate position along the segment
    car.x = currentNode.x + dx * car.progress;
    car.y = currentNode.y + dy * car.progress;
  }
}

// Reset car position to start and path progress
function resetCar() {
  car.x = start.x;
  car.y = start.y;
  car.segIndex = 0;
  car.progress = 0;
}

 // --- Mouse Event Handlers for Drawing Roads ---

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  drawStart = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
});

canvas.addEventListener('mousemove', (e) => {
  if (isDrawing) {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (isDrawing) {
    const rect = canvas.getBoundingClientRect();
    const endPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    // Only add the road if the segment length is significant
    if (Math.hypot(endPos.x - drawStart.x, endPos.y - drawStart.y) > 5) {
      roads.push({ x1: drawStart.x, y1: drawStart.y, x2: endPos.x, y2: endPos.y });
    }
    isDrawing = false;
  }
});

// --- Drawing the Scene ---

function drawScene() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background grid
  drawGrid();

  // Draw all road segments
  ctx.strokeStyle = '#0af';
  ctx.lineWidth = 4;
  roads.forEach(road => {
    ctx.beginPath();
    ctx.moveTo(road.x1, road.y1);
    ctx.lineTo(road.x2, road.y2);
    ctx.stroke();
  });

  // Draw preview of current road while drawing
  if (isDrawing) {
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(drawStart.x, drawStart.y);
    ctx.lineTo(mousePos.x, mousePos.y);
    ctx.stroke();
  }

  // Draw start (warehouse) and destination (delivery) nodes
  ctx.fillStyle = '#0f0';
  ctx.beginPath();
  ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f00';
  ctx.beginPath();
  ctx.arc(dest.x, dest.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // Optionally, draw the computed path (for debugging)
  if (car.path) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(car.path[0].x, car.path[0].y);
    for (let i = 1; i < car.path.length; i++) {
      ctx.lineTo(car.path[i].x, car.path[i].y);
    }
    ctx.stroke();
  }

  // Draw the delivery car as a small circle
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(car.x, car.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Draw score
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + score, 10, 25);
}

// --- Main Game Loop ---
function gameLoop() {
  updateCar();
  drawScene();
  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
