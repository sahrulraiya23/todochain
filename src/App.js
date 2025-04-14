import React, { useState, useEffect } from "react";
import { Blockchain } from "./Blockchain";
import { createPeer } from "./peer";

function App() {
  // User & Login States
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Task & Form States
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assigneeUsername, setAssigneeUsername] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [chain, setChain] = useState(new Blockchain());
  
  // P2P Connection States
  const [peer, setPeer] = useState(null);
  const [conn, setConn] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Tidak terhubung");
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsername, setConnectedUsername] = useState("");
  
  // Mining States
  const [isMining, setIsMining] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const [difficulty, setDifficulty] = useState(2);

  // Handle Login
  const handleLogin = () => {
    if (!username.trim()) {
      setLoginError("Username tidak boleh kosong");
      return;
    }

    try {
      const newPeer = createPeer(username);
      
      if (!newPeer) {
        setLoginError("Gagal membuat koneksi peer. Coba username lain.");
        return;
      }
      
      setPeer(newPeer);
      setIsLoggedIn(true);
      setLoginError("");
      
      // Set up peer event listeners
      setupPeerListeners(newPeer);
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Terjadi kesalahan saat login. Coba username lain.");
    }
  };

  // Handle Logout
  const handleLogout = () => {
    if (conn) {
      try {
        conn.close();
      } catch (error) {
        console.error("Error closing connection:", error);
      }
    }
    
    if (peer) {
      try {
        peer.destroy();
      } catch (error) {
        console.error("Error destroying peer:", error);
      }
    }
    
    setIsLoggedIn(false);
    setPeer(null);
    setConn(null);
    setUsername("");
    setConnectedUsers([]);
    setConnectionStatus("Tidak terhubung");
    setIsConnected(false);
    setConnectedUsername("");
  };

  // Set up peer event listeners
  const setupPeerListeners = (p) => {
    p.on("open", (id) => {
      console.log("Logged in as:", id);
    });

    p.on("connection", (c) => {
      c.on("open", () => {
        console.log("Peer connected:", c.peer);
        setConn(c);
        setIsConnected(true);
        setConnectionStatus(`Terhubung dengan ${c.peer}`);
        setConnectedUsername(c.peer);
        
        // Add to connected users list if not already there
        setConnectedUsers(prev => {
          if (!prev.includes(c.peer)) {
            return [...prev, c.peer];
          }
          return prev;
        });
      });
      
      c.on("close", () => {
        console.log("Connection closed:", c.peer);
        setConnectionStatus("Tidak terhubung");
        setIsConnected(false);
        setConnectedUsername("");
        
        // Remove from connected users list
        setConnectedUsers(prev => prev.filter(user => user !== c.peer));
      });
      
      c.on("error", (err) => {
        console.error("Connection error:", err);
        setConnectionStatus("Error koneksi");
        setIsConnected(false);
        setConnectedUsername("");
      });
      
      c.on("data", (data) => {
        handleIncomingData(data);
      });
    });

    p.on("error", (err) => {
      console.error("PeerJS error:", err);
    });
  };

  // Handle incoming data from peers
  const handleIncomingData = (data) => {
    if (data.type === "block") {
      // Handle new task block
      try {
        const newBlock = chain.addBlock(data.data);
        setBlocks([...chain.chain]);
      } catch (error) {
        console.error("Error adding received block:", error);
      }
    } else if (data.type === "complete-task") {
      // Handle task completion
      try {
        chain.completeTask(data.blockIndex, data.completedBy);
        setBlocks([...chain.chain]);
      } catch (error) {
        console.error("Error completing task:", error);
      }
    } else if (data.type === "sync-request") {
      // Send blockchain to requesting peer
      if (conn) {
        conn.send({ type: "sync-response", data: chain.chain });
      }
    } else if (data.type === "sync-response") {
      // Validate and update local blockchain if needed
      if (chain.isValidChain(data.data) && data.data.length > chain.chain.length) {
        chain.chain = data.data;
        setBlocks([...chain.chain]);
      }
    }
  };

  // Connect to a peer by username
  const connectToUser = () => {
    if (assigneeUsername.trim() !== "" && assigneeUsername !== username) {
      try {
        setConnectionStatus(`Menghubungkan ke ${assigneeUsername}...`);
        
        const connection = peer.connect(assigneeUsername);
        
        connection.on("open", () => {
          console.log("Connected to:", assigneeUsername);
          setConn(connection);
          setIsConnected(true);
          setConnectionStatus(`Terhubung dengan ${assigneeUsername}`);
          setConnectedUsername(assigneeUsername);
          
          // Add to connected users list
          setConnectedUsers(prev => {
            if (!prev.includes(assigneeUsername)) {
              return [...prev, assigneeUsername];
            }
            return prev;
          });
          
          // Sync blockchains
          connection.send({ type: "sync-request" });
        });
        
        connection.on("close", () => {
          console.log("Connection closed");
          setConnectionStatus("Tidak terhubung");
          setIsConnected(false);
          setConnectedUsername("");
          
          // Remove from connected users
          setConnectedUsers(prev => prev.filter(user => user !== assigneeUsername));
        });
        
        connection.on("error", (err) => {
          console.error("Connection error:", err);
          setConnectionStatus("Error koneksi");
          setIsConnected(false);
          setConnectedUsername("");
        });
        
        connection.on("data", (data) => {
          handleIncomingData(data);
        });
      } catch (error) {
        console.error("Error connecting to peer:", error);
        setConnectionStatus("Gagal terhubung");
      }
    }
  };

  // Disconnect from current peer
  const disconnectFromUser = () => {
    if (conn) {
      try {
        conn.close();
      } catch (error) {
        console.error("Error closing connection:", error);
      }
      setConn(null);
      setConnectionStatus("Tidak terhubung");
      setIsConnected(false);
      setConnectedUsername("");
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
          
          // Send to connected peer if this is a task for them
          if (conn && pendingTask.assignedTo === connectedUsername) {
            conn.send({ type: "block", data: pendingTask });
          }
          
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
      
      // Notify the assigner if connected
      if (conn && block.data.assignedBy === connectedUsername) {
        conn.send({ 
          type: "complete-task", 
          blockIndex: blockIndex,
          completedBy: username
        });
      }
      
      alert("Tugas berhasil ditandai sebagai selesai!");
    } catch (error) {
      console.error("Error completing task:", error);
      alert("Terjadi kesalahan saat menyelesaikan tugas: " + error.message);
    }
  };

  // Reset the blockchain
  const resetBlockchain = () => {
    const newChain = new Blockchain();
    setBlocks([...newChain.chain]);
    setChain(newChain);
    setPendingTask(null);
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
      peerInfo += `   Status: ${connectedUsername === user ? 'Terhubung' : 'Tidak terhubung'}\n\n`;
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
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>ToDoChain P2P Username 🧠</h1>
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
          /* Login Form */
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", maxWidth: "500px", margin: "80px auto" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1e40af", marginBottom: "24px", textAlign: "center" }}>Login dengan Username</h2>
            
            {loginError && (
              <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
                {loginError}
              </div>
            )}
            
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#4b5563" }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda"
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
            
            <button 
              onClick={handleLogin}
              disabled={!username.trim()}
              style={{ 
                backgroundColor: username.trim() ? "#2563eb" : "#93c5fd", 
                color: "white", 
                fontWeight: "500", 
                padding: "12px 24px", 
                borderRadius: "6px", 
                border: "none", 
                cursor: username.trim() ? "pointer" : "not-allowed", 
                transition: "background-color 0.3s",
                width: "100%",
                fontSize: "1rem"
              }}
            >
              Login
            </button>
          </div>
        ) : (
          /* Main Application (after login) */
          <>
            {/* Connection Section */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Koneksi User</h2>
              
              {/* Connection Status */}
              <div style={{ 
                backgroundColor: isConnected ? "#dcfce7" : connectionStatus === "Tidak terhubung" ? "#fee2e2" : "#fef3c7", 
                color: isConnected ? "#166534" : connectionStatus === "Tidak terhubung" ? "#991b1b" : "#92400e",
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
                
                {isConnected && (
                  <button 
                    onClick={disconnectFromUser}
                    style={{ 
                      backgroundColor: "#ef4444", 
                      color: "white", 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      border: "none", 
                      cursor: "pointer", 
                      fontSize: "0.875rem"
                    }}
                  >
                    Putuskan
                  </button>
                )}
              </div>
              
              <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
                <input
                  placeholder="Username Teman"
                  value={assigneeUsername}
                  onChange={(e) => setAssigneeUsername(e.target.value)}
                  disabled={isConnected}
                  style={{ 
                    flexGrow: 1, 
                    padding: "8px 16px", 
                    border: "1px solid #d1d5db", 
                    borderRadius: "6px", 
                    outline: "none",
                    backgroundColor: isConnected ? "#f1f5f9" : "white",
                    cursor: isConnected ? "not-allowed" : "text"
                  }}
                />
                <button 
                  onClick={connectToUser}
                  disabled={isConnected || assigneeUsername.trim() === "" || assigneeUsername === username}
                  style={{ 
                    backgroundColor: isConnected || assigneeUsername.trim() === "" || assigneeUsername === username ? "#93c5fd" : "#2563eb", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: isConnected || assigneeUsername.trim() === "" || assigneeUsername === username ? "not-allowed" : "pointer", 
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
  
            {/* Control Buttons */}
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
                  onClick={() => {
                    if (conn) {
                      conn.send({ type: "sync-request" });
                    }
                  }}
                  disabled={!isConnected}
                  style={{ 
                    backgroundColor: isConnected ? "#2563eb" : "#93c5fd", 
                    color: "white", 
                    fontWeight: "500", 
                    padding: "8px 16px", 
                    borderRadius: "6px", 
                    border: "none", 
                    cursor: isConnected ? "pointer" : "not-allowed", 
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