import React, { useState, useEffect } from "react";
import { Blockchain } from "./Blockchain";
import { createPeer } from "./peer";

function App() {
  const [input, setInput] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [chain, setChain] = useState(new Blockchain());
  const [peer, setPeer] = useState(null);
  const [conn, setConn] = useState(null);
  const [peerId, setPeerId] = useState("");
  const [yourId, setYourId] = useState("");
  const [isMining, setIsMining] = useState(false);
  const [difficulty, setDifficulty] = useState(2);
  const [pendingTask, setPendingTask] = useState(""); // State untuk menyimpan tugas yang sedang menunggu mining

  useEffect(() => {
    const p = createPeer();
    setPeer(p);

    p.on("open", (id) => {
      console.log("Peer ID kamu:", id);
      setYourId(id);
    });

    p.on("connection", (c) => {
      c.on("data", (data) => {
        if (data.type === "block") {
          chain.addBlock(data.data);
          setBlocks([...chain.chain]);
        }
      });
      setConn(c);
    });

    p.on("error", (err) => {
      console.error("PeerJS error:", err);
    });
  }, []);

  const connectToPeer = () => {
    if (peerId.trim() !== "") {
      const connection = peer.connect(peerId);
      connection.on("open", () => {
        setConn(connection);
        connection.send({ type: "sync-request" });
      });
      
      connection.on("data", (data) => {
        if (data.type === "block") {
          chain.addBlock(data.data);
          setBlocks([...chain.chain]);
        } else if (data.type === "sync-request") {
          connection.send({ type: "sync-response", data: chain.chain });
        } else if (data.type === "sync-response") {
          if (chain.isValidChain(data.data) && data.data.length > chain.chain.length) {
            chain.chain = data.data;
            setBlocks([...chain.chain]);
          }
        }
      });
    }
  };

  // Fungsi untuk menyimpan tugas yang akan di-mining nanti
  const addTaskToPending = () => {
    if (input.trim() !== "") {
      setPendingTask(input);
      setInput("");
    }
  };

  // Fungsi untuk melakukan mining pada tugas yang tertunda
  const mineBlock = async () => {
    if (pendingTask.trim() !== "") {
      setIsMining(true);
      
      setTimeout(() => {
        try {
          // Sesuaikan kesulitan jika chain sudah memiliki blok
          if (chain.chain.length > 1) {
            chain.difficulty = chain.adjustDifficulty();
            setDifficulty(chain.difficulty);
          }
          
          // Tambahkan blok (proses mining terjadi di sini)
          chain.addBlock(pendingTask);
          setBlocks([...chain.chain]);
          
          // Kirim ke peer terhubung
          if (conn) {
            conn.send({ type: "block", data: pendingTask });
          }
          
          // Reset pending task setelah mining berhasil
          setPendingTask("");
        } catch (error) {
          console.error("Error saat mining:", error);
          alert("Terjadi kesalahan saat mining blok");
        } finally {
          setIsMining(false);
        }
      }, 100);
    } else {
      alert("Tidak ada tugas yang menunggu untuk di-mining!");
    }
  };

  const printJSON = () => {
    const jsonData = JSON.stringify(chain.chain, null, 2);
    console.log("Blockchain JSON:", jsonData);
    alert("JSON dicetak ke console 👀");
  };
  
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
  
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #ebf5ff, #e1efff)" }}>
      {/* Navbar */}
      <nav style={{ backgroundColor: "#1e40af", color: "white", padding: "16px", boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "32px", width: "32px" }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3a1 1 0 01-.293-.707V7z" clipRule="evenodd" />
            </svg>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>ToDoChain P2P 🧠</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button style={{ backgroundColor: "#2563eb", color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer", transition: "background-color 0.3s" }}>
              Panduan Pengguna
            </button>
            <button style={{ backgroundColor: "#2563eb", color: "white", padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer", transition: "background-color 0.3s" }}>
              Tentang Aplikasi
            </button>
          </div>
        </div>
      </nav>
  
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        {/* User ID Card */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
          <p style={{ fontSize: "1.125rem" }}>
            <span style={{ fontWeight: "bold", color: "#1e40af" }}>ID Kamu:</span> 
            <span style={{ marginLeft: "8px", backgroundColor: "#dbeafe", padding: "4px 12px", borderRadius: "6px", color: "#1e40af" }}>{yourId}</span>
          </p>
        </div>
  
        {/* Connection Section */}
        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Koneksi Peer</h2>
          <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
            <input
              placeholder="ID Teman"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              style={{ 
                flexGrow: 1, 
                padding: "8px 16px", 
                border: "1px solid #d1d5db", 
                borderRadius: "6px", 
                outline: "none"
              }}
            />
            <button 
              onClick={connectToPeer} 
              style={{ 
                backgroundColor: "#2563eb", 
                color: "white", 
                fontWeight: "500", 
                padding: "8px 16px", 
                borderRadius: "6px", 
                border: "none", 
                cursor: "pointer", 
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
              Hubungkan ke Peer
            </button>
          </div>
        </div>
  
        {/* Task Input Section */}
        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Tambahkan Tugas</h2>
          <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Masukkan tugas baru"
              style={{ 
                flexGrow: 1, 
                padding: "8px 16px", 
                border: "1px solid #d1d5db", 
                borderRadius: "6px", 
                outline: "none"
              }}
            />
            <button 
              onClick={addTaskToPending} 
              style={{ 
                backgroundColor: "#16a34a", 
                color: "white", 
                fontWeight: "500", 
                padding: "8px 24px", 
                borderRadius: "6px", 
                border: "none", 
                cursor: "pointer", 
                transition: "background-color 0.3s",
                display: "flex",
                alignItems: "center"
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "20px", width: "20px", marginRight: "8px" }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Tambahkan
            </button>
          </div>
        </div>

        {/* Pending Task & Mining Section */}
        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>Tugas Tertunda & Mining</h2>
          
          {pendingTask ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "500", color: "#4b5563", marginBottom: "8px" }}>Tugas yang menunggu untuk di-mining:</h3>
              <div style={{ padding: "12px", backgroundColor: "#f3f4f6", borderRadius: "6px", fontWeight: "500" }}>
                {pendingTask}
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", marginBottom: "16px" }}>
              Tidak ada tugas yang menunggu untuk di-mining
            </div>
          )}
          
          <button 
            onClick={mineBlock}
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
              onClick={() => console.log(peer.connections)} 
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
              Lihat Peer Aktif
            </button>
            <button
              onClick={() => {
                const newChain = new Blockchain();
                setBlocks([...newChain.chain]);
                setChain(newChain);
                setPendingTask("");
              }}
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
                  blocks.forEach((b) => {
                    conn.send({ type: "block", data: b.data });
                  });
                }
              }}
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
              Kirim Ulang Blockchain
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
          {blocks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              Belum ada tugas yang ditambahkan
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {blocks.map((b, i) => (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", transition: "box-shadow 0.3s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", fontWeight: "bold", padding: "4px 12px", borderRadius: "6px" }}>Block #{b.index}</span>
                    <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>{b.timestamp}</span>
                  </div>
                  <div style={{ marginTop: "12px", marginBottom: "8px", fontSize: "1.125rem", fontWeight: "500" }}>{b.data}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <div><span style={{ fontWeight: "600" }}>Hash:</span> {b.hash}</div>
                    <div><span style={{ fontWeight: "600" }}>Previous Hash:</span> {b.previousHash}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;