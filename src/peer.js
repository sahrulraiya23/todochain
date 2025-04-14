import Peer from 'peerjs';

// Create a peer connection with username as ID
export const createPeer = (username) => {
  if (!username || username.trim() === '') {
    console.error("Username is required");
    return null;
  }
  
  // Sanitize username to ensure it's valid for PeerJS ID (alphanumeric)
  const sanitizedUsername = username.trim().replace(/[^a-zA-Z0-9]/g, '-');
  
  // PeerJS configuration options
  const peerOptions = {
    debug: 3, // 0 = no logs, 3 = all logs
    config: {
      'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  // Try creating a new peer connection with the username
  try {
    const peer = new Peer(sanitizedUsername, peerOptions);
    
    // Log for debugging
    console.log(`PeerJS instance created with username: ${sanitizedUsername}`);
    
    return peer;
  } catch (error) {
    console.error("Error creating PeerJS instance:", error);
    alert("Terjadi kesalahan saat membuat koneksi P2P. Silakan coba dengan username lain atau muat ulang halaman.");
    return null;
  }
};