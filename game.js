// ----- Setup & Global Variables -----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
const SNAP_THRESHOLD = 10; // pixels for snapping endpoints
const roads = [];  // Array to store drawn road segments

// Fixed start and destination nodes (warehouse & delivery)
const start = { x: 80, y: 80 };
const dest = { x: canvas.width - 80, y: canvas.height - 80 };

// Variables for drawing roads via mouse
let isDrawing = false;
let drawStart = { x: 0, y: 0 };
let mousePos = { x: 0, y: 0 };

//
// ----- Classes -----
//

// Road class represents a drawn road segment
class Road {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2; this.y2 = y2;
  }
  draw(ctx) {
    ctx.strokeStyle = '#0af';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
  }
}

// Car class moves along a computed path (an array of nodes)
class Car {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.speed = 2;
    this.path = null;
    this.segIndex = 0;
    this.progress = 0;
  }
  update() {
    if (this.path && this.path.length > 1) {
      const curr = this.path[this.segIndex];
      const next = this.path[this.segIndex + 1];
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const segLength = Math.hypot(dx, dy);
      this.progress += this.speed / segLength;
      if (this.progress >= 1) {
        this.segIndex++;
        this.progress = 0;
        if (this.segIndex >= this.path.length - 1) {
          // Reached destination: update score and reset the car
          score++;
          resetCar();
          return;
        }
      }
      this.x = curr.x + dx * this.progress;
      this.y = curr.y + dy * this.progress;
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Create the delivery car starting at the warehouse
const car = new Car(start.x, start.y);

//
// ----- Graph & Pathfinding -----
//

// Helper: checks if point (x,y) is near any node in the list. If yes, returns that node.
function getOrCreateNode(x, y, nodes) {
  for (const node of nodes) {
    if (Math.hypot(node.x - x, node.y - y) < SNAP_THRESHOLD) {
      return node;
    }
  }
  const newNode = { id: nodes.length, x, y };
  nodes.push(newNode);
  return newNode;
}

// Build a graph from road endpoints, plus the fixed start and destination.
function buildGraph() {
  const nodes = [];
  const adj = {}; // adjacency list: { nodeId: [{id: neighborId, dist: number}, ...] }
  
  function addEdge(n1, n2) {
    const d = Math.hypot(n1.x - n2.x, n1.y - n2.y);
    if (!adj[n1.id]) adj[n1.id] = [];
    if (!adj[n2.id]) adj[n2.id] = [];
    adj[n1.id].push({ id: n2.id, dist: d });
    adj[n2.id].push({ id: n1.id, dist: d });
  }
  
  // Add fixed start & destination
  const startNode = getOrCreateNode(start.x, start.y, nodes);
  const destNode = getOrCreateNode(dest.x, dest.y, nodes);
  
  // Process each road segment as two nodes with an edge
  roads.forEach(r => {
    const nodeA = getOrCreateNode(r.x1, r.y1, nodes);
    const nodeB = getOrCreateNode(r.x2, r.y2, nodes);
    addEdge(nodeA, nodeB);
  });
  
  return { nodes, adj, startNode, destNode };
}

// Breadth-First Search to compute a simple path from start to destination.
function findPath(graph) {
  const { nodes, adj, startNode, destNode } = graph;
  const queue = [startNode.id];
  const cameFrom = {};
  cameFrom[startNode.id] = null;
  
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === destNode.id) {
      // Reconstruct path
      const path = [];
      let curr = current;
      while (curr !== null) {
        const node = nodes.find(n => n.id === curr);
        path.unshift(node);
        curr = cameFrom[curr];
      }
      return path;
    }
    for (const neighbor of adj[current] || []) {
      if (!(neighbor.id in cameFrom)) {
        cameFrom[neighbor.id] = current;
        queue.push(neighbor.id);
      }
    }
  }
  return null;
}

//
// ----- Drawing & Update Functions -----
//

// Draw a grid background (for a neat minimalist look)
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

// Update the car by rebuilding the graph and recalculating the path.
function updateCar() {
  const graph = buildGraph();
  const path = findPath(graph);
  car.path = path;
  // If a valid path is found, reset segment tracking if needed.
  if (car.path && car.path.length > 1 && car.segIndex >= car.path.length) {
    car.segIndex = 0;
    car.progress = 0;
  }
  car.update();
}

// Clear the canvas and redraw the entire scene.
function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  
  // Draw all roads
  roads.forEach(r => {
    new Road(r.x1, r.y1, r.x2, r.y2).draw(ctx);
  });
  
  // Draw the current road being drawn (if any)
  if (isDrawing) {
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(drawStart.x, drawStart.y);
    ctx.lineTo(mousePos.x, mousePos.y);
    ctx.stroke();
  }
  
  // Draw fixed nodes: warehouse (start) & delivery (dest)
  ctx.fillStyle = '#0f0';
  ctx.beginPath();
  ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#f00';
  ctx.beginPath();
  ctx.arc(dest.x, dest.y, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Optionally draw the computed path (for debugging/visualization)
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
  
  // Draw the car
  car.draw(ctx);
  
  // Display score
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + score, 10, 25);
}

// Reset the car to the start position and reset path progress.
function resetCar() {
  car.x = start.x;
  car.y = start.y;
  car.segIndex = 0;
  car.progress = 0;
}

//
// ----- Mouse Event Handlers -----
//

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
    // Only add road if drawn length is significant
    if (Math.hypot(endPos.x - drawStart.x, endPos.y - drawStart.y) > 5) {
      roads.push({ x1: drawStart.x, y1: drawStart.y, x2: endPos.x, y2: endPos.y });
    }
    isDrawing = false;
  }
});

//
// ----- Main Game Loop -----
//

function gameLoop() {
  updateCar();
  drawScene();
  requestAnimationFrame(gameLoop);
}

gameLoop();
