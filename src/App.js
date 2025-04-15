import React, { useState, useEffect } from "react";
import { Blockchain } from "./Blockchain";
import { createPeer } from "./peer";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyAR2vQdUlREl_WJZVRYAwXicF651Dr1rQ8",
  authDomain: "todochain-5d1f3.firebaseapp.com",
  projectId: "todochain-5d1f3",
  storageBucket: "todochain-5d1f3.firebasestorage.app",
  messagingSenderId: "496314167100",
  appId: "1:496314167100:web:fb3f0c40d92f2d80837839",
  measurementId: "G-JJF3HCG3PS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  // User & Authentication States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Database simulation (in a real app, this would be server-side)
  const [userDatabase, setUserDatabase] = useState({});

  // Task & Form States
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assigneeUsername, setAssigneeUsername] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [chain, setChain] = useState(new Blockchain());
  
  // P2P Connection States
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState({}); 
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Tidak terhubung");
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Mining States
  const [isMining, setIsMining] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const [difficulty, setDifficulty] = useState(2);

  // Save users to localStorage when the database changes
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        
        const users = {};
        querySnapshot.forEach((doc) => {
          users[doc.id] = doc.data();
        });
        
        setUserDatabase(users);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };    fetchUsers();
  }, []);


  // Toggle between login and registration forms
  const toggleAuthMode = () => {
    setIsRegistering(!isRegistering);
    setAuthError("");
    setPassword("");
    setConfirmPassword("");
  };

  // Handle Registration
  const handleRegister = async () => {
    // Form validation
    if (!username.trim()) {
      setAuthError("Username tidak boleh kosong");
      return;
    }
    
    if (!password.trim()) {
      setAuthError("Password tidak boleh kosong");
      return;
    }
    
    if (password !== confirmPassword) {
      setAuthError("Password dan konfirmasi password tidak cocok");
      return;
    }
    
    try {
      // Periksa apakah username sudah ada
      const userRef = doc(db, "users", username);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setAuthError("Username sudah terdaftar");
        return;
      }
      
      // Buat user baru
      await setDoc(userRef, {
        password, // Catatan: Dalam aplikasi nyata, password harus di-hash!
        createdAt: new Date().toISOString()
      });
      
      // Update state lokal
      const updatedUsers = {
        ...userDatabase,
        [username]: { password, createdAt: new Date().toISOString() }
      };
      setUserDatabase(updatedUsers);
      
      setAuthError("");
      setIsRegistering(false);
      setPassword("");
      setConfirmPassword("");
      
      alert(`Pendaftaran berhasil! Silakan login dengan username ${username}`);
    } catch (error) {
      console.error("Error registering user:", error);
      setAuthError("Terjadi kesalahan saat mendaftar");
    }
  };

  // Handle Login
  const handleLogin = async () => {
    // Form validation
    if (!username.trim()) {
      setAuthError("Username tidak boleh kosong");
      return;
    }
    
    if (!password.trim()) {
      setAuthError("Password tidak boleh kosong");
      return;
    }
    
    try {
      // Dapatkan data pengguna dari Firestore
      const userRef = doc(db, "users", username);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        setAuthError("Username tidak ditemukan");
        return;
      }
      
      const userData = userSnap.data();
      
      if (userData.password !== password) {
        setAuthError("Password salah");
        return;
      }
      
      // Buat koneksi peer
      try {
        const newPeer = createPeer(username);
        
        if (!newPeer) {
          setAuthError("Gagal membuat koneksi peer. Coba username lain.");
          return;
        }
        
        setPeer(newPeer);
        setIsLoggedIn(true);
        setAuthError("");
        setPassword("");
        
        setupPeerListeners(newPeer);
      } catch (error) {
        console.error("Login error:", error);
        setAuthError("Terjadi kesalahan saat login");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setAuthError("Terjadi kesalahan saat login");
    }
  };

  // Handle Logout
  const handleLogout = () => {
    // Close all connections
    Object.values(connections).forEach(conn => {
      try {
        conn.close();
      } catch (error) {
        console.error("Error closing connection:", error);
      }
    });
    
    if (peer) {
      try {
        peer.destroy();
      } catch (error) {
        console.error("Error destroying peer:", error);
      }
    }
    
    setIsLoggedIn(false);
    setPeer(null);
    setConnections({});
    setUsername("");
    setConnectedUsers([]);
    setConnectionStatus("Tidak terhubung");
  };

  // Set up peer event listeners
  const setupPeerListeners = (p) => {
    p.on("open", (id) => {
      console.log("Logged in as:", id);
    });

    p.on("connection", (c) => {
      setupConnectionListeners(c);
    });

    p.on("error", (err) => {
      console.error("PeerJS error:", err);
    });
  };

  // Set up connection listeners
  const setupConnectionListeners = (c) => {
    c.on("open", () => {
      console.log("Peer connected:", c.peer);
      
      // Store the connection in our connections object
      setConnections(prev => ({
        ...prev,
        [c.peer]: c
      }));
      
      // Update the UI and connected users list
      updateConnectionStatus();
      
      // Add to connected users list if not already there
      setConnectedUsers(prev => {
        if (!prev.includes(c.peer)) {
          return [...prev, c.peer];
        }
        return prev;
      });
      
      // Sync blockchains
      c.send({ type: "sync-request" });
    });
    
    c.on("close", () => {
      console.log("Connection closed:", c.peer);
      
      // Remove the connection from our connections object
      setConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[c.peer];
        return newConnections;
      });
      
      // Update the UI and connected users list
      updateConnectionStatus();
      
      // Remove from connected users list
      setConnectedUsers(prev => prev.filter(user => user !== c.peer));
    });
    
    c.on("error", (err) => {
      console.error("Connection error:", err);
      
      // Remove the connection from our connections object
      setConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[c.peer];
        return newConnections;
      });
      
      // Update the UI
      updateConnectionStatus();
    });
    
    c.on("data", (data) => {
      handleIncomingData(data, c.peer);
    });
  };

  // Helper function to update connection status
  const updateConnectionStatus = () => {
    setConnections(prev => {
      const connectedCount = Object.keys(prev).length;
      
      if (connectedCount === 0) {
        setConnectionStatus("Tidak terhubung");
      } else if (connectedCount === 1) {
        const peerId = Object.keys(prev)[0];
        setConnectionStatus(`Terhubung dengan ${peerId}`);
      } else {
        setConnectionStatus(`Terhubung dengan ${connectedCount} pengguna`);
      }
      
      return prev;
    });
  };

  // Handle incoming data from peers
  const handleIncomingData = (data, sender) => {
    if (data.type === "block") {
      // Handle new task block
      try {
        const newBlock = chain.addBlock(data.data);
        setBlocks([...chain.chain]);
        
        // Forward to other connected peers (except the sender)
        broadcastToOtherPeers(data, sender);
      } catch (error) {
        console.error("Error adding received block:", error);
      }
    } else if (data.type === "complete-task") {
      // Handle task completion
      try {
        chain.completeTask(data.blockIndex, data.completedBy);
        setBlocks([...chain.chain]);
        
        // Forward to other connected peers (except the sender)
        broadcastToOtherPeers(data, sender);
      } catch (error) {
        console.error("Error completing task:", error);
      }
    } else if (data.type === "sync-request") {
      // Send blockchain to requesting peer
      const connection = connections[sender];
      if (connection) {
        connection.send({ type: "sync-response", data: chain.chain });
      }
    } else if (data.type === "sync-response") {
      // Validate and update local blockchain if needed
      if (chain.isValidChain(data.data) && data.data.length > chain.chain.length) {
        chain.chain = data.data;
        setBlocks([...chain.chain]);
      }
    } else if (data.type === "reset-blockchain") {
      // Handle blockchain reset request
      console.log(`Received reset blockchain request from ${sender}`);
      
      // Create new blockchain
      const newChain = new Blockchain();
      
      // Update local state
      setBlocks([...newChain.chain]);
      setChain(newChain);
      setPendingTask(null);
      
      // Show notification
      const resetNotification = `Blockchain direset oleh ${data.initiator} 🔄`;
      alert(resetNotification);
      
      // Forward reset message to other connected peers (except the sender)
      broadcastToOtherPeers(data, sender);
    }
  };

  // Broadcast data to all peers except the sender
  const broadcastToOtherPeers = (data, excludeUser) => {
    Object.entries(connections).forEach(([peerId, connection]) => {
      if (peerId !== excludeUser) {
        try {
          connection.send(data);
        } catch (error) {
          console.error(`Error sending data to ${peerId}:`, error);
        }
      }
    });
  };

  // Connect to a peer by username
  const connectToUser = () => {
    if (assigneeUsername.trim() !== "" && assigneeUsername !== username) {
      // Don't connect if already connected
      if (connections[assigneeUsername]) {
        alert(`Sudah terhubung dengan ${assigneeUsername}`);
        return;
      }
      
      try {
        setIsConnecting(true);
        setConnectionStatus(`Menghubungkan ke ${assigneeUsername}...`);
        
        const connection = peer.connect(assigneeUsername);
        
        // Set up listeners for the new connection
        setupConnectionListeners(connection);
        
        // Reset the connecting state after some time
        setTimeout(() => {
          setIsConnecting(false);
        }, 5000);
      } catch (error) {
        console.error("Error connecting to peer:", error);
        setConnectionStatus("Gagal terhubung");
        setIsConnecting(false);
      }
    }
  };

  // Disconnect from a specific user
  const disconnectFromUser = (userToDisconnect) => {
    const connection = connections[userToDisconnect];
    if (connection) {
      try {
        connection.close();
      } catch (error) {
        console.error(`Error closing connection to ${userToDisconnect}:`, error);
      }
      
      // Remove the connection from our connections object
      setConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[userToDisconnect];
        return newConnections;
      });
      
      // Update the UI
      updateConnectionStatus();
      
      // Remove from connected users list
      setConnectedUsers(prev => prev.filter(user => user !== userToDisconnect));
    }
  };

  // Add a task to pending
  const addTaskToPending = () => {
    if (taskTitle.trim() !== "" && assigneeUsername.trim() !== "") {
      const newTask = {
        title: taskTitle,
        description: taskDescription,
        assignedBy: username,
        assignedTo: assigneeUsername,
        isCompleted: false,
        completedAt: null
      };
      
      setPendingTask(newTask);
      setTaskTitle("");
      setTaskDescription("");
    } else {
      alert("Judul tugas dan username penerima tugas harus diisi");
    }
  };

  // Mine a new task block
  const mineTaskBlock = () => {
    if (pendingTask) {
      setIsMining(true);
      
      setTimeout(() => {
        try {
          // Adjust difficulty if needed
          if (chain.chain.length > 1) {
            chain.difficulty = chain.adjustDifficulty();
            setDifficulty(chain.difficulty);
          }
          
          // Add block (mining happens here)
          const newBlock = chain.addBlock(pendingTask);
          setBlocks([...chain.chain]);
          
          // Send to the specific peer if this is a task for them
          const targetConnection = connections[pendingTask.assignedTo];
          if (targetConnection) {
            targetConnection.send({ type: "block", data: pendingTask });
          }
          
          // Broadcast to all other peers for better synchronization
          broadcastToOtherPeers({ type: "block", data: pendingTask }, pendingTask.assignedTo);
          
          // Reset pending task
          setPendingTask(null);
        } catch (error) {
          console.error("Mining error:", error);
          alert("Terjadi kesalahan saat mining blok");
        } finally {
          setIsMining(false);
        }
      }, 100);
    } else {
      alert("Tidak ada tugas yang menunggu untuk di-mining");
    }
  };

  // Mark a task as completed
  const completeTask = (blockIndex) => {
    try {
      const block = chain.chain[blockIndex];
      
      // Check if this task is assigned to the current user
      if (block.data.assignedTo !== username) {
        alert("Anda hanya dapat menyelesaikan tugas yang ditugaskan kepada Anda");
        return;
      }
      
      // Check if task is already completed
      if (block.data.isCompleted) {
        alert("Tugas ini sudah diselesaikan");
        return;
      }
      
      // Mark task as completed
      const completionBlock = chain.completeTask(blockIndex, username);
      setBlocks([...chain.chain]);
      
      // Send update to the task creator if connected
      const creatorConnection = connections[block.data.assignedBy];
      if (creatorConnection) {
        creatorConnection.send({ 
          type: "complete-task", 
          blockIndex: blockIndex,
          completedBy: username
        });
      }
      
      // Broadcast to all other connected peers for better synchronization
      broadcastToOtherPeers({ 
        type: "complete-task", 
        blockIndex: blockIndex,
        completedBy: username
      }, block.data.assignedBy);
      
      alert("Tugas berhasil ditandai sebagai selesai!");
    } catch (error) {
      console.error("Error completing task:", error);
      alert("Terjadi kesalahan saat menyelesaikan tugas: " + error.message);
    }
  };

  // Synchronize blockchain with all peers
  const syncWithAllPeers = () => {
    if (Object.keys(connections).length === 0) {
      alert("Tidak ada koneksi peer aktif untuk sinkronisasi");
      return;
    }
    
    Object.values(connections).forEach(connection => {
      try {
        connection.send({ type: "sync-request" });
      } catch (error) {
        console.error(`Error syncing with peer ${connection.peer}:`, error);
      }
    });
    
    alert("Permintaan sinkronisasi dikirim ke semua peers");
  };

  // Reset the blockchain
  const resetBlockchain = () => {
    // Ask for confirmation before resetting
    const confirmReset = window.confirm(
      "Apakah Anda yakin ingin mereset blockchain?\n\nIni akan mereset blockchain untuk semua user yang terhubung."
    );

    if (!confirmReset) {
      return;
    }

    // Create new blockchain
    const newChain = new Blockchain();
    
    // Update local state
    setBlocks([...newChain.chain]);
    setChain(newChain);
    setPendingTask(null);
    
    // Create reset message to broadcast to all peers
    const resetMessage = {
      type: "reset-blockchain",
      timestamp: new Date().toLocaleString(),
      initiator: username
    };
    
    // Broadcast reset message to all connected peers
    Object.values(connections).forEach(connection => {
      try {
        connection.send(resetMessage);
        console.log(`Sent reset request to: ${connection.peer}`);
      } catch (error) {
        console.error(`Error sending reset to ${connection.peer}:`, error);
      }
    });
    
    // Show success message
    alert("Blockchain berhasil direset! 🔄");
  };

  // Print blockchain as JSON
  const printJSON = () => {
    const jsonData = JSON.stringify(chain.chain, null, 2);
    console.log("Blockchain JSON:", jsonData);
    alert("JSON dicetak ke console 👀");
  };
  
  // Download blockchain as JSON
  const downloadJSON = () => {
    const jsonData = JSON.stringify(chain.chain, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "todochain.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("JSON berhasil diunduh 📦");
  };

  // Show active peer connections
  const showActivePeers = () => {
    if (!peer) {
      alert("Peer belum diinisialisasi");
      return;
    }
    
    if (connectedUsers.length === 0) {
      alert("Tidak ada user aktif yang terhubung saat ini");
      return;
    }
    
    let peerInfo = "Daftar User Aktif:\n\n";
    connectedUsers.forEach((user, index) => {
      peerInfo += `${index + 1}. Username: ${user}\n`;
      peerInfo += `   Status: ${connections[user] ? 'Terhubung' : 'Tidak terhubung'}\n\n`;
    });
    
    alert(peerInfo);
  };

  // Update blocks state when chain initializes
  useEffect(() => {
    setBlocks([...chain.chain]);
  }, []);
  
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #ebf5ff, #e1efff)" }}>
      {/* Navbar */}
      <nav style={{ backgroundColor: "#1e40af", color: "white", padding: "16px", boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "32px", width: "32px" }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3a1 1 0 01-.293-.707V7z" clipRule="evenodd" />
            </svg>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>ToDoChain P2P Multi-User 🧠</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {isLoggedIn && (
              <span style={{ backgroundColor: "#2563eb", color: "white", padding: "8px 16px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "20px", width: "20px" }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                {username}
              </span>
            )}
            {isLoggedIn && (
              <button 
                onClick={handleLogout}
                style={{ backgroundColor: "#ef4444", color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer", transition: "background-color 0.3s" }}
              >
                Keluar
              </button>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        {!isLoggedIn ? (
          /* Authentication Form (Login/Register) */
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", maxWidth: "500px", margin: "80px auto" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1e40af", marginBottom: "24px", textAlign: "center" }}>
              {isRegistering ? "Daftar Akun Baru" : "Login"}
            </h2>
            
            {authError && (
              <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
                {authError}
              </div>
            )}
            
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                style={{ 
                  width: "100%", 
                  padding: "12px 16px", 
                  border: "1px solid #d1d5db", 
                  borderRadius: "6px", 
                  outline: "none",
                  fontSize: "1rem"
                }}
              />
            </div>
            
            <div style={{ marginBottom: isRegistering ? "24px" : "32px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                style={{ 
                  width: "100%", 
                  padding: "12px 16px", 
                  border: "1px solid #d1d5db", 
                  borderRadius: "6px", 
                  outline: "none",
                  fontSize: "1rem"
                }}
              />
            </div>
            
            {isRegistering && (
              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Masukkan ulang password"
                  style={{ 
                    width: "100%", 
                    padding: "12px 16px", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px", 
                    outline: "none",
                    fontSize: "1rem"
                  }}
                />
              </div>
            )}
            
            <button 
              onClick={isRegistering ? handleRegister : handleLogin}
              disabled={!username.trim() || !password.trim() || (isRegistering && password !== confirmPassword)}
              style={{ 
                backgroundColor: username.trim() && password.trim() && (!isRegistering || password === confirmPassword) ? "#2563eb" : "#93c5fd", 
                color: "white", 
                fontWeight: "500", 
                padding: "12px 24px", 
                borderRadius: "6px", 
                border: "none", 
                cursor: username.trim() && password.trim() && (!isRegistering || password === confirmPassword) ? "pointer" : "not-allowed", 
                transition: "background-color 0.3s",
                width: "100%",
                fontSize: "1rem",
                marginBottom: "16px"
              }}
            >
              {isRegistering ? "Daftar" : "Login"}
            </button>
            
            <p style={{ textAlign: "center", color: "#4b5563", fontSize: "0.875rem" }}>
              {isRegistering ? "Sudah punya akun? " : "Belum punya akun? "}
              <button 
                onClick={toggleAuthMode}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#2563eb", 
                  cursor: "pointer", 
                  fontWeight: "500",
                  padding: "0"
                }}
              >
                {isRegistering ? "Login" : "Daftar sekarang"}
              </button>
            </p>
          </div>
        ) : (
          /* Main Application (after login) */
          <>
            {/* Connection Section */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Koneksi User</h2>
              
              {/* Connection Status */}
              <div style={{ 
                backgroundColor: Object.keys(connections).length > 0 ? "#dcfce7" : connectionStatus === "Tidak terhubung" ? "#fee2e2" : "#fef3c7", 
                color: Object.keys(connections).length > 0 ? "#166534" : connectionStatus === "Tidak terhubung" ? "#991b1b" : "#92400e",
                padding: "8px 16px", 
                borderRadius: "6px", 
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <span>
                  <span style={{ fontWeight: "bold" }}>Status: </span>
                  {connectionStatus}
                </span>
                
                {Object.keys(connections).length > 0 && (
                  <button 
                    onClick={showActivePeers}
                    style={{ 
                      backgroundColor: "#3b82f6", 
                      color: "white", 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      border: "none", 
                      cursor: "pointer", 
                      fontSize: "0.875rem"
                    }}
                  >
                    Lihat Koneksi
                  </button>
                )}
              </div>
              
              {/* Connected Users List */}
              {connectedUsers.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: "bold", color: "#4b5563", marginBottom: "8px" }}>User Terhubung ({connectedUsers.length})</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {connectedUsers.map(user => (
                      <div key={user} style={{ 
                        backgroundColor: "#f0f9ff", 
                        borderRadius: "6px", 
                        padding: "4px 12px", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between",
                        gap: "8px"
                      }}>
                        <span>{user}</span>
                        <button
                          onClick={() => disconnectFromUser(user)}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "white",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: "bold"
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
                <input
                  placeholder="Username Teman"
                  value={assigneeUsername}
                  onChange={(e) => setAssigneeUsername(e.target.value)}
                  disabled={isConnecting}
                  style={{ 
                    flexGrow: 1, 
                    padding: "8px 16px", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px", 
                    outline: "none",
                    backgroundColor: isConnecting ? "#f1f5f9" : "white",
                    cursor: isConnecting ? "not-allowed" : "text"
                  }}
                />
                <button 
                  onClick={connectToUser}
                  disabled={isConnecting || assigneeUsername.trim() === "" || assigneeUsername === username || connections[assigneeUsername]}
                  style={{ 
                    backgroundColor: isConnecting || assigneeUsername.trim() === "" || assigneeUsername === username || connections[assigneeUsername] ? "#93c5fd" : "#2563eb", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: isConnecting || assigneeUsername.trim() === "" || assigneeUsername === username || connections[assigneeUsername] ? "not-allowed" : "pointer", 
                    transition: "background-color 0.3s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "20px", width: "20px", marginRight: "8px" }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M3 8a7 7 0 1114 0A7 7 0 013 8zm7-5a5 5 0 00-5 5c0 1.6.8 3.1 2 4.1V15a1 1 0 00.5.9l3 1.8a1 1 0 001 0l3-1.8a1 1 0 00.5-.9v-2.9a5 5 0 002-4.1 5 5 0 00-5-5z" clipRule="evenodd" />
                  </svg>
                  Hubungkan
                </button>
              </div>
            </div>
  
            {/* Task Input Section */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Tambahkan Tugas</h2>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Judul Tugas</label>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Masukkan judul tugas"
                  style={{ 
                    width: "100%", 
                    padding: "8px 16px", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px", 
                    outline: "none"
                  }}
                />
              </div>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Deskripsi (Opsional)</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Deskripsi tugas lebih detail"
                  rows={3}
                  style={{ 
                    width: "100%", 
                    padding: "8px 16px", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px", 
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Ditugaskan Kepada</label>
                <input
                  value={assigneeUsername}
                  onChange={(e) => setAssigneeUsername(e.target.value)}
                  placeholder="Username penerima tugas"
                  style={{ 
                    width: "100%", 
                    padding: "8px 16px", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px", 
                    outline: "none"
                  }}
                />
              </div>
              
              <button 
                onClick={addTaskToPending} 
                disabled={!taskTitle.trim() || !assigneeUsername.trim()}
                style={{ 
                  backgroundColor: taskTitle.trim() && assigneeUsername.trim() ? "#16a34a" : "#d1fae5", 
                  color: "white", 
                  fontWeight: "500", 
                  padding: "8px 24px", 
                  borderRadius: "6px", 
                  border: "none", 
                  cursor: taskTitle.trim() && assigneeUsername.trim() ? "pointer" : "not-allowed", 
                  transition: "background-color 0.3s",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "20px", width: "20px", marginRight: "8px" }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Siapkan Tugas
              </button>
            </div>

            {/* Pending Task & Mining Section */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Tugas Tertunda & Mining</h2>
              
              {pendingTask ? (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: "500", color: "#4b5563", marginBottom: "8px" }}>Tugas yang menunggu untuk di-mining:</h3>
                  <div style={{ padding: "12px", backgroundColor: "#f3f4f6", borderRadius: "6px", fontWeight: "500" }}>
                    <div style={{ marginBottom: "8px" }}><span style={{ fontWeight: "600" }}>Judul:</span> {pendingTask.title}</div>
                    {pendingTask.description && (
                      <div style={{ marginBottom: "8px" }}><span style={{ fontWeight: "600" }}>Deskripsi:</span> {pendingTask.description}</div>
                    )}
                    <div style={{ marginBottom: "8px" }}><span style={{ fontWeight: "600" }}>Dari:</span> {pendingTask.assignedBy}</div>
                    <div><span style={{ fontWeight: "600" }}>Untuk:</span> {pendingTask.assignedTo}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", marginBottom: "16px" }}>
                  Tidak ada tugas yang menunggu untuk di-mining
                </div>
              )}
              
              <button 
                onClick={mineTaskBlock}
                disabled={!pendingTask || isMining}
                style={{ 
                  backgroundColor: pendingTask && !isMining ? "#ef4444" : "#f1f5f9", 
                  color: pendingTask && !isMining ? "white" : "#94a3b8",
                  fontWeight: "500", 
                  padding: "12px 24px", 
                  borderRadius: "6px", 
                  border: "none", 
                  width: "100%",
                  cursor: pendingTask && !isMining ? "pointer" : "not-allowed", 
                  transition: "all 0.3s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {isMining ? (
                  <>
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" style={{ height: "24px", width: "24px", marginRight: "8px" }} viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Mining...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "24px", width: "24px", marginRight: "8px" }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    Mulai Mining
                  </>
                )}
              </button>
              <div style={{ marginTop: "12px", fontSize: "0.875rem", color: "#6b7280", display: "flex", alignItems: "center" }}>
                <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "16px", width: "16px", marginRight: "4px" }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Kesulitan saat ini: {difficulty}
              </div>
            </div>
            {/* Control Buttons - MODIFIED FOR MULTI-USER */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Kontrol</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                <button 
                  onClick={showActivePeers} 
                  style={{ 
                    backgroundColor: "#2563eb", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: "pointer", 
                    transition: "background-color 0.3s"
                  }}
                >
                  Lihat User Aktif
                </button>
                <button
                  onClick={resetBlockchain}
                  style={{ 
                    backgroundColor: "#dc2626", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: "pointer", 
                    transition: "background-color 0.3s"
                  }}
                >
                  Reset Blockchain
                </button>
                <button
                  onClick={syncWithAllPeers}
                  disabled={Object.keys(connections).length === 0}
                  style={{ 
                    backgroundColor: Object.keys(connections).length > 0 ? "#2563eb" : "#93c5fd", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: Object.keys(connections).length > 0 ? "pointer" : "not-allowed", 
                    transition: "background-color 0.3s"
                  }}
                >
                  Sinkronisasi Blockchain
                </button>
                <button
                  onClick={() => alert(chain.isValidChain(blocks) ? "✅ Chain Valid" : "❌ Chain TIDAK valid")}
                  style={{ 
                    backgroundColor: "#16a34a", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: "pointer", 
                    transition: "background-color 0.3s"
                  }}
                >
                  Cek Validitas
                </button>
                <button 
                  onClick={printJSON} 
                  style={{ 
                    backgroundColor: "#9333ea", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: "pointer", 
                    transition: "background-color 0.3s"
                  }}
                >
                  Cetak JSON
                </button>
                <button 
                  onClick={downloadJSON} 
                  style={{ 
                    backgroundColor: "#0d9488", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: "pointer", 
                    transition: "background-color 0.3s"
                  }}
                >
                  Download JSON
                </button>
              </div>
            </div>

            {/* Task List */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Daftar Tugas Blockchain</h2>
              {blocks.length <= 1 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
                  Belum ada tugas yang ditambahkan
                </div>
              ) : (
                <div style={{ display: "grid", gap: "16px" }}>
                  {blocks.slice(1).map((block, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        border: "1px solid #e5e7eb", 
                        borderRadius: "8px", 
                        padding: "16px", 
                        transition: "box-shadow 0.3s",
                        backgroundColor: block.data.isCompleted ? "#f0fdf4" : "white",
                        borderLeft: block.data.isCompleted ? "4px solid #16a34a" : block.data.assignedTo === username ? "4px solid #3b82f6" : "4px solid #f59e0b"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ 
                          backgroundColor: block.data.isCompleted ? "#dcfce7" : "#dbeafe", 
                          color: block.data.isCompleted ? "#166534" : "#1e40af", 
                          fontWeight: "bold", 
                          padding: "4px 12px", 
                          borderRadius: "6px" 
                        }}>
                          {block.data.isCompleted ? "✓ Selesai" : "○ Tugas #" + block.index}
                        </span>
                        <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>{block.timestamp}</span>
                      </div>
                      
                      <div style={{ marginTop: "12px", marginBottom: "8px" }}>
                        <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "4px" }}>{block.data.title}</h3>
                        {block.data.description && (
                          <p style={{ color: "#4b5563", marginBottom: "8px" }}>{block.data.description}</p>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                            <span style={{ fontWeight: "600" }}>Dari:</span> {block.data.assignedBy}
                          </span>
                          <span style={{ fontSize: "0.875rem", color: "#6b7280", marginLeft: "12px" }}>
                            <span style={{ fontWeight: "600" }}>Untuk:</span> {block.data.assignedTo}
                          </span>
                        </div>
                        
                        {block.data.assignedTo === username && !block.data.isCompleted && (
                          <button
                            onClick={() => completeTask(block.index)}
                            style={{ 
                              backgroundColor: "#16a34a", 
                              color: "white", 
                              fontWeight: "500", 
                              padding: "4px 12px", 
                              borderRadius: "6px", 
                              border: "none", 
                              cursor: "pointer", 
                              fontSize: "0.875rem",
                              display: "flex",
                              alignItems: "center"
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "16px", width: "16px", marginRight: "4px" }} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Selesaikan
                          </button>
                        )}
                      </div>
                      
                      <div style={{ fontSize: "0.75rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div><span style={{ fontWeight: "600" }}>Hash:</span> {block.hash.substring(0, 20)}...</div>
                        <div><span style={{ fontWeight: "600" }}>Previous Hash:</span> {block.previousHash.substring(0, 16)}...</div>
                        {block.data.isCompleted && (
                          <div style={{ marginTop: "4px", color: "#166534" }}>
                            <span style={{ fontWeight: "600" }}>Diselesaikan pada:</span> {block.data.completedAt}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;