// peer.js
import Peer from 'peerjs';

export const createPeer = () => {
  // Opsi konfigurasi PeerJS
  const peerOptions = {
    debug: 3, // 0 = no logs, 3 = all logs
    config: {
      'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  // Mencoba membuat koneksi peer baru
  try {
    const peer = new Peer(generateRandomId(), peerOptions);
    
    // Log untuk debugging
    console.log("PeerJS instance created");
    
    return peer;
  } catch (error) {
    console.error("Error creating PeerJS instance:", error);
    alert("Terjadi kesalahan saat membuat koneksi P2P. Silakan muat ulang halaman.");
    return null;
  }
};

// Fungsi untuk menghasilkan ID acak jika diperlukan
function generateRandomId() {
  return 'todochain-' + Math.random().toString(36).substr(2, 9);
}