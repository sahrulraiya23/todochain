// signaling-server.js
// In a real application, this would be an Express/Node.js server
// This example shows how you would implement this with WebSockets

/* Server-side code (Node.js + Express + Socket.io) */
/*
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your application's domain
    methods: ["GET", "POST"]
  }
});

// Store connected users
const connectedUsers = new Map(); // username -> {socketId, peerId}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Register user
  socket.on('register', ({ username, peerId }) => {
    console.log(`User registered: ${username} (${peerId})`);
    
    // Check if username already exists
    const existingSocket = [...connectedUsers.values()].find(user => user.username === username);
    if (existingSocket) {
      socket.emit('register-error', { message: 'Username already in use' });
      return;
    }
    
    // Register the user
    connectedUsers.set(socket.id, { username, peerId, socketId: socket.id });
    
    // Notify the user that registration was successful
    socket.emit('register-success', { username, peerId });
    
    // Broadcast updated user list to all clients
    broadcastUserList();
  });
  
  // Handle peer connection request
  socket.on('request-connection', ({ target, from }) => {
    console.log(`Connection request from ${from} to ${target}`);
    
    // Find the target user
    const targetUser = [...connectedUsers.values()].find(user => user.username === target);
    if (!targetUser) {
      socket.emit('connection-error', { message: 'Target user not found' });
      return;
    }
    
    // Find the source user
    const sourceUser = connectedUsers.get(socket.id);
    if (!sourceUser) {
      socket.emit('connection-error', { message: 'You are not registered' });
      return;
    }
    
    // Send connection request to target
    io.to(targetUser.socketId).emit('connection-request', {
      from: sourceUser.username,
      peerId: sourceUser.peerId
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove user from connected users
    connectedUsers.delete(socket.id);
    
    // Broadcast updated user list
    broadcastUserList();
  });
  
  // Broadcast all online users to everyone
  function broadcastUserList() {
    const userList = [...connectedUsers.values()].map(user => ({
      username: user.username,
      peerId: user.peerId
    }));
    
    io.emit('user-list', { users: userList });
  }
});

// API routes
app.get('/api/users', (req, res) => {
  const userList = [...connectedUsers.values()].map(user => ({
    username: user.username
  }));
  
  res.json({ users: userList });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
*/

// Client-side implementation (to be used in your React app)

/**
 * SignalingClient - Manages connection to the signaling server
 * In a real implementation, this would connect to your remote signaling server
 */
export class SignalingClient {
    constructor() {
      this.socket = null;
      this.username = null;
      this.peerId = null;
      this.onlineUsers = [];
      this.listeners = {
        userList: [],
        connectionRequest: [],
        registerSuccess: [],
        registerError: [],
        connectionError: []
      };
      
      // For this simplified version, we'll simulate the signaling server with localStorage
      this.useLocalStorage = true;
      this.localStorageKey = 'todochain_online_users';
      
      // Setup polling for localStorage-based implementation
      if (this.useLocalStorage) {
        // Initialize the localStorage if needed
        if (!localStorage.getItem(this.localStorageKey)) {
          localStorage.setItem(this.localStorageKey, JSON.stringify([]));
        }
        
        // Set up polling to check for changes
        this.pollInterval = setInterval(() => {
          this.checkOnlineUsers();
        }, 5000); // Check every 5 seconds
      }
    }
    
    /**
     * Connect to the signaling server
     * @returns {Promise} resolves when connected
     */
    connect() {
      if (this.useLocalStorage) {
        // Simulate an immediate connection
        return Promise.resolve();
      }
      
      // In a real implementation with Socket.io:
      /*
      return new Promise((resolve, reject) => {
        if (this.socket) {
          resolve();
          return;
        }
        
        // Connect to the signaling server
        this.socket = io('http://localhost:3001');
        
        this.socket.on('connect', () => {
          console.log('Connected to signaling server');
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });
        
        // Set up event listeners
        this.socket.on('user-list', (data) => {
          this.onlineUsers = data.users;
          this.notifyListeners('userList', this.onlineUsers);
        });
        
        this.socket.on('connection-request', (data) => {
          this.notifyListeners('connectionRequest', data);
        });
        
        this.socket.on('register-success', (data) => {
          this.notifyListeners('registerSuccess', data);
        });
        
        this.socket.on('register-error', (data) => {
          this.notifyListeners('registerError', data);
        });
        
        this.socket.on('connection-error', (data) => {
          this.notifyListeners('connectionError', data);
        });
      });
      */
    }
    
    /**
     * Register a user with the signaling server
     * @param {string} username - The username to register
     * @param {string} peerId - The PeerJS ID
     * @returns {Promise} resolves when registered
     */
    register(username, peerId) {
      this.username = username;
      this.peerId = peerId;
      
      if (this.useLocalStorage) {
        // Simulate registration with localStorage
        try {
          const onlineUsersJson = localStorage.getItem(this.localStorageKey) || '[]';
          const onlineUsers = JSON.parse(onlineUsersJson);
          
          // Check if username is already taken
          if (onlineUsers.some(user => user.username === username)) {
            this.notifyListeners('registerError', { message: 'Username already in use' });
            return Promise.reject(new Error('Username already in use'));
          }
          
          // Add user to online users
          onlineUsers.push({ username, peerId, lastSeen: new Date().toISOString() });
          localStorage.setItem(this.localStorageKey, JSON.stringify(onlineUsers));
          
          // Update our list of online users
          this.onlineUsers = onlineUsers.filter(user => user.username !== username);
          
          // Notify listeners
          this.notifyListeners('registerSuccess', { username, peerId });
          this.notifyListeners('userList', this.onlineUsers);
          
          // Set up cleanup on page unload
          window.addEventListener('beforeunload', () => {
            this.unregister();
          });
          
          return Promise.resolve();
        } catch (error) {
          console.error('Error registering user:', error);
          return Promise.reject(error);
        }
      }
      
      // In a real implementation with Socket.io:
      /*
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Not connected to signaling server'));
          return;
        }
        
        this.socket.emit('register', { username, peerId });
        
        // Success will be handled by the register-success event
        this.addListener('registerSuccess', () => {
          resolve();
        }, true);
        
        // Error will be handled by the register-error event
        this.addListener('registerError', (error) => {
          reject(error);
        }, true);
      });
      */
    }
    
    /**
     * Unregister a user from the signaling server
     */
    unregister() {
      if (!this.username) {
        return;
      }
      
      if (this.useLocalStorage) {
        // Simulate unregistration with localStorage
        try {
          const onlineUsersJson = localStorage.getItem(this.localStorageKey) || '[]';
          const onlineUsers = JSON.parse(onlineUsersJson);
          
          // Remove user from online users
          const filteredUsers = onlineUsers.filter(user => user.username !== this.username);
          localStorage.setItem(this.localStorageKey, JSON.stringify(filteredUsers));
          
          // Clear our username and peerId
          this.username = null;
          this.peerId = null;
          
          // Clear polling interval
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
          }
        } catch (error) {
          console.error('Error unregistering user:', error);
        }
        
        return;
      }
      
      // In a real implementation with Socket.io:
      /*
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      */
    }
    
    /**
     * Request a connection to another user
     * @param {string} targetUsername - The username to connect to
     */
    requestConnection(targetUsername) {
      if (!this.username) {
        console.error('Not registered');
        return;
      }
      
      if (this.useLocalStorage) {
        // In the localStorage implementation, we don't need to request a connection
        // since all peer IDs are already available
        try {
          const onlineUsersJson = localStorage.getItem(this.localStorageKey) || '[]';
          const onlineUsers = JSON.parse(onlineUsersJson);
          
          // Find the target user
          const targetUser = onlineUsers.find(user => user.username === targetUsername);
          
          if (!targetUser) {
            this.notifyListeners('connectionError', { message: 'Target user not found' });
            return;
          }
          
          // Simulate a connection request event
          this.notifyListeners('connectionRequest', {
            from: this.username,
            peerId: targetUser.peerId
          });
        } catch (error) {
          console.error('Error requesting connection:', error);
        }
        
        return;
      }
      
      // In a real implementation with Socket.io:
      /*
      if (!this.socket) {
        console.error('Not connected to signaling server');
        return;
      }
      
      this.socket.emit('request-connection', {
        target: targetUsername,
        from: this.username
      });
      */
    }
    
    /**
     * Check for online users
     * This is only used in the localStorage implementation
     */
    checkOnlineUsers() {
      if (!this.useLocalStorage || !this.username) {
        return;
      }
      
      try {
        const onlineUsersJson = localStorage.getItem(this.localStorageKey) || '[]';
        const onlineUsers = JSON.parse(onlineUsersJson);
        
        // Filter out inactive users (older than 1 minute)
        const now = new Date();
        const activeUsers = onlineUsers.filter(user => {
          const lastSeen = new Date(user.lastSeen);
          const diffInMinutes = (now - lastSeen) / (1000 * 60);
          return diffInMinutes < 1;
        });
        
        // Update our own last seen time
        const updatedUsers = activeUsers.map(user => {
          if (user.username === this.username) {
            return { ...user, lastSeen: now.toISOString() };
          }
          return user;
        });
        
        // Save the updated users
        localStorage.setItem(this.localStorageKey, JSON.stringify(updatedUsers));
        
        // Update our list of online users (excluding ourselves)
        const otherUsers = updatedUsers.filter(user => user.username !== this.username);
        
        // Only notify if the list has changed
        if (JSON.stringify(otherUsers) !== JSON.stringify(this.onlineUsers)) {
          this.onlineUsers = otherUsers;
          this.notifyListeners('userList', otherUsers);
        }
      } catch (error) {
        console.error('Error checking online users:', error);
      }
    }
    
    /**
     * Add a listener for an event
     * @param {string} event - The event to listen for
     * @param {Function} callback - The callback function
     * @param {boolean} once - Whether the listener should be called only once
     */
    addListener(event, callback, once = false) {
      if (!this.listeners[event]) {
        console.error(`Unknown event: ${event}`);
        return;
      }
      
      this.listeners[event].push({ callback, once });
    }
    
    /**
     * Remove a listener for an event
     * @param {string} event - The event to listen for
     * @param {Function} callback - The callback function to remove
     */
    removeListener(event, callback) {
      if (!this.listeners[event]) {
        console.error(`Unknown event: ${event}`);
        return;
      }
      
      this.listeners[event] = this.listeners[event].filter(
        listener => listener.callback !== callback
      );
    }
    
    /**
     * Notify all listeners of an event
     * @param {string} event - The event that occurred
     * @param {any} data - The data to pass to listeners
     */
    notifyListeners(event, data) {
      if (!this.listeners[event]) {
        console.error(`Unknown event: ${event}`);
        return;
      }
      
      // Call all listeners
      this.listeners[event].forEach(listener => {
        listener.callback(data);
      });
      
      // Remove one-time listeners
      this.listeners[event] = this.listeners[event].filter(
        listener => !listener.once
      );
    }
    
    /**
     * Get the list of online users
     * @returns {Array} - The list of online users
     */
    getOnlineUsers() {
      return [...this.onlineUsers];
    }
  }
  
  // Export a singleton instance
  export const signalingClient = new SignalingClient();
  
  export default signalingClient;