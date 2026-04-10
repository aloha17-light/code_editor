// =============================================================================
// CodeForge — Real-Time Collaboration Server
// =============================================================================
//
// ACADEMIC CONTEXT (M.Sc. Thesis — Systems Architecture)
// -------------------------------------------------------
// This server enables real-time collaborative code editing between two or more
// users working on the same algorithmic problem. It is built on three core
// technologies:
//
//   1. **WebSockets (RFC 6455)**
//      HTTP is a request-response protocol — the client asks, the server
//      answers, then the connection dies. WebSockets upgrade that initial
//      HTTP handshake into a persistent, full-duplex TCP channel. This
//      allows the server to PUSH updates to all connected clients the
//      instant a keystroke happens, without polling.
//
//   2. **Yjs (CRDT Library)**
//      Yjs implements a Conflict-free Replicated Data Type (CRDT). A CRDT
//      is a data structure that can be modified concurrently by multiple
//      peers WITHOUT a central authority or locking mechanism. Each edit is
//      tagged with a unique Lamport timestamp and client ID. When two users
//      type at the same position simultaneously, the CRDT deterministically
//      resolves the conflict using these timestamps — both clients converge
//      to the exact same document state without any manual merge.
//
//   3. **y-websocket**
//      This is the official Yjs network transport layer. It handles:
//        - Broadcasting incremental document updates (deltas) to all peers
//        - Syncing the full document state when a new client joins mid-session
//        - The "Awareness" protocol (cursor positions, user names, colors)
//
// ARCHITECTURE
// -------------------------------------------------------
//
//   Browser A                    This Server                  Browser B
//   (Monaco Editor)              (Port 1234)                  (Monaco Editor)
//       |                            |                            |
//       |--- ws:// upgrade --------->|                            |
//       |<-- 101 Switching ---------|                            |
//       |                            |<--- ws:// upgrade --------|
//       |                            |--- 101 Switching -------->|
//       |                            |                            |
//       |-- Y.Doc update (delta) -->|-- broadcast delta -------->|
//       |                            |                            |
//       |<-- broadcast delta -------|<-- Y.Doc update (delta) --|
//       |                            |                            |
//
// Each "room" corresponds to a unique Yjs document identified by a room name
// (e.g., "problem-uuid-abc123"). Multiple rooms can exist simultaneously.
//
// =============================================================================

const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

// =============================================================================
// Configuration
// =============================================================================

const PORT = process.env.PORT || 4444;
const HOST = process.env.HOST || 'localhost';

// =============================================================================
// Step 1: Create a standard HTTP server
// =============================================================================
// The HTTP server serves two purposes:
//   (a) It provides a health-check endpoint for Docker/load-balancer probes.
//   (b) It acts as the initial handshake surface for the WebSocket upgrade.
//
// When a browser sends a WebSocket connection request, it actually starts as
// a regular HTTP GET request with special headers:
//   - `Connection: Upgrade`
//   - `Upgrade: websocket`
//   - `Sec-WebSocket-Key: <random base64>`
//
// The server then responds with HTTP 101 "Switching Protocols" and the TCP
// connection is "upgraded" from HTTP to the WebSocket binary framing protocol.
// =============================================================================

const server = http.createServer((req, res) => {
  // Simple health check for monitoring / Docker HEALTHCHECK
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'codeforge-collaboration-server',
      protocol: 'yjs-websocket',
      uptime: process.uptime()
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CodeForge Collaboration Server (Yjs WebSocket) is running.\n');
});

// =============================================================================
// Step 2: Create the WebSocket server (wss) on top of the HTTP server
// =============================================================================
// We attach the WebSocket server to the same HTTP server so they share the
// same port. The `ws` library automatically handles the HTTP → WebSocket
// upgrade negotiation described above.
// =============================================================================

const wss = new WebSocket.Server({ server });

// =============================================================================
// Step 3: Handle incoming WebSocket connections with Yjs
// =============================================================================
// When a client connects, `setupWSConnection` from y-websocket takes over.
// It performs the following automatically:
//
//   1. **Room Resolution**: Extracts the room name from the URL path.
//      e.g., ws://localhost:1234/my-room-id → room = "my-room-id"
//
//   2. **Document Sync**: If the Yjs document for this room already exists
//      in memory (because another user is editing), the server sends the
//      current document state (as a "state vector") to the new client.
//      The new client then requests only the missing updates (deltas),
//      achieving an efficient incremental sync.
//
//   3. **Update Broadcasting**: When any client sends a document update
//      (e.g., a keystroke), the server broadcasts that update to ALL other
//      clients in the same room. Each client's local Yjs CRDT engine
//      applies the update and resolves any conflicts deterministically.
//
//   4. **Awareness Sync**: Separately from document content, the Awareness
//      protocol syncs ephemeral state like cursor positions, user names,
//      and selection colors. This data is NOT persisted — it exists only
//      while the WebSocket connection is alive.
//
//   5. **Garbage Collection (gc: true)**: Yjs periodically compacts the
//      internal operation log to prevent unbounded memory growth. This is
//      safe because CRDTs maintain consistency through their algebraic
//      properties (commutativity, associativity, idempotence), not through
//      preserving the full operation history.
// =============================================================================

wss.on('connection', (conn, req) => {
  // Extract room name from URL for logging
  const roomName = req.url?.slice(1) || 'default';
  console.log(`[COLLAB] New peer connected to room: "${roomName}" (Total peers: ${wss.clients.size})`);

  // Delegate all Yjs synchronization logic to the official handler
  setupWSConnection(conn, req, {
    gc: true  // Enable garbage collection for long-running sessions
  });

  // Log disconnections for debugging
  conn.on('close', () => {
    console.log(`[COLLAB] Peer disconnected from room: "${roomName}" (Remaining peers: ${wss.clients.size})`);
  });
});

// =============================================================================
// Step 4: Start listening
// =============================================================================

server.listen(PORT, HOST, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  CodeForge Collaboration Server                         ║
  ║  Protocol: Yjs WebSocket (CRDT)                         ║
  ║  Listening: ws://${HOST}:${PORT}                        ║
  ║                                                          ║
  ║  Rooms are created dynamically per WebSocket URL path.   ║
  ║  e.g., ws://localhost:${PORT}/my-room-id                ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});
