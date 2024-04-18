// Sufyan Khan
// 2023/10/04

let net = require("net"),
  kadPTPpacket = require("./kadPTPmessage"),
  singleton = require("./Singleton"),
  ITPpacket = require("./ITPResponse");

const fs = require("fs");

let myReceivingPort = null;
let mySendingPort = null;

let peersList = [];

module.exports = {
  handleClientJoining: function (sock, serverDHTtable) {
    // accept anyways in this assignment
    handleClient(sock, serverDHTtable);
  },
  handleCommunications: function (clientSocket, clientName, clientDHTtable) {
    communicate(clientSocket, clientName, clientDHTtable);
  },
};

function handleClient(sock, serverDHTtable) {
  let kadPacket = null;
  let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;

  // initialize client DHT table
  let joiningPeerID = singleton.getPeerID(sock.remoteAddress, sock.remotePort);
  let joiningPeer = {
    peerName: "",
    peerIP: sock.remoteAddress,
    peerPort: sock.remotePort,
    peerID: joiningPeerID,
  };

  // Triggered only when the client is sending kadPTP message
  sock.on("data", (message) => {
    kadPacket = parseMessage(message);
  });

  sock.on("end", () => {
    // client edded the connection
    if (kadPacket) {
      // Here, the msgType cannot be 1. It can be 2 or greater
      if (kadPacket.msgType == 2) {
        console.log("Received Hello Message from " + kadPacket.senderName);

        if (kadPacket.peersList.length > 0) {
          let output = "  along with DHT: ";
          // now we can assign the peer name
          joiningPeer.peerName = kadPacket.senderName;
          for (var i = 0; i < kadPacket.peersList.length; i++) {
            output +=
              "[" +
              kadPacket.peersList[i].peerIP +
              ":" +
              kadPacket.peersList[i].peerPort +
              ", " +
              kadPacket.peersList[i].peerID +
              "]\n                  ";
          }
          console.log(output);
        }

        // add the sender into the table only if it is not exist or set the name of the exisiting one
        let exist = serverDHTtable.table.find(
          (e) => e.node.peerPort == joiningPeer.peerPort
        );
        if (exist) {
          exist.node.peerName = joiningPeer.peerName;
        } else {
          pushBucket(serverDHTtable, joiningPeer);
        }

        // Now update the DHT table
        updateDHTtable(serverDHTtable, kadPacket.peersList);
      }
    } else {
      // This was a bootstrap request
      console.log("Connected from peer " + joiningPeerAddress + "\n");
      // add the requester info into server DHT table
      pushBucket(serverDHTtable, joiningPeer);
    }
  });

  if (kadPacket == null) {
    // This is a bootstrap request
    // send acknowledgment to the client
    kadPTPpacket.init(7, 1, serverDHTtable);
    sock.write(kadPTPpacket.getPacket());
    sock.end();
  }
}

function communicate(clientSocket, clientName, clientDHTtable) {
  let senderPeerID = singleton.getPeerID(
    clientSocket.remoteAddress,
    clientSocket.remotePort
  );

  clientSocket.on("data", (message) => {
    let packetType = parseBitPacket(message, 4, 8);

    if (packetType == 1) {
      let kadPacket = parseMessage(message);

      let senderPeerName = kadPacket.senderName;
      let senderPeer = {
        peerName: senderPeerName,
        peerIP: clientSocket.remoteAddress,
        peerPort: clientSocket.remotePort,
        peerID: senderPeerID,
      };

      // This message comes from the server
      console.log(
        "Connected to " +
          senderPeerName +
          ":" +
          clientSocket.remotePort +
          " at timestamp: " +
          singleton.getTimestamp() +
          "\n"
      );

      // Now run as a server
      myReceivingPort = clientSocket.localPort;
      let localPeerID = singleton.getPeerID(
        clientSocket.localAddress,
        myReceivingPort
      );
      let serverPeer = net.createServer();
      serverPeer.listen(myReceivingPort, clientSocket.localAddress);
      console.log(
        "This peer address is " +
          clientSocket.localAddress +
          ":" +
          myReceivingPort +
          " located at " +
          clientName +
          " [" +
          localPeerID +
          "]\n"
      );

      // Wait for other peers to connect
      serverPeer.on("connection", function (sock) {
        // again we will accept all connections in this assignment
        handleClient(sock, clientDHTtable);
      });

      console.log("Received Welcome message from " + senderPeerName) + "\n";
      if (kadPacket.peersList.length > 0) {
        let output = "  along with DHT: ";
        for (var i = 0; i < kadPacket.peersList.length; i++) {
          output +=
            "[" +
            kadPacket.peersList[i].peerIP +
            ":" +
            kadPacket.peersList[i].peerPort +
            ", " +
            kadPacket.peersList[i].peerID +
            "]\n                  ";
        }
        console.log(output);
      } else {
        console.log("  along with DHT: []\n");
      }

      // add the bootstrap node into the DHT table but only if it is not exist already
      let exist = clientDHTtable.table.find(
        (e) => e.node.peerPort == clientSocket.remotePort
      );
      if (!exist) {
        pushBucket(clientDHTtable, senderPeer);
      } else {
        console.log(senderPeer.peerPort + " is exist already");
      }

      updateDHTtable(clientDHTtable, kadPacket.peersList);
    } else {
      console.log("Some other message type.");
    }
  });

  clientSocket.on("end", () => {
    // disconnected from server
    sendHello(clientDHTtable);
  });

  // Create a socket to listen for ptp search requests
  let peerSocket = net.createServer();
  peerSocket.listen(clientSocket.localPort + 10000, clientSocket.localAddress);

  peerSocket.on("connection", (sock) => {
    handlePTPrequests(
      sock,
      clientSocket.localAddress,
      clientSocket.localPort,
      clientDHTtable
    );
  });
}

// Get the data and send back the image if you have it, otherwise pass on the request
function handlePTPrequests(sock, myIP, myPort, myDHT) {
  sock.on("data", (msg) => {
    let kadPTPrequest = parseRequest(msg);
    console.log(
      `Recieved kadPTP search request from: ${kadPTPrequest.senderName}`
    );

    let imageFullName = kadPTPrequest.imageName + "." + kadPTPrequest.imageType;
    let imageData;

    try {
      imageData = fs.readFileSync(imageFullName);

      ITPpacket.init(
        7,
        1, // response type
        singleton.getSequenceNumber(), // sequence number
        singleton.getTimestamp(), // timestamp
        imageData // image data
      );

      sock.write(ITPpacket.getBytePacket());
      sock.end();
    } catch (err) {
      // Find the closest peer
      let myID = singleton.getPeerID(myIP, myPort);
      let closestPeer = myDHT.table[0].node.peerID;
      for (peer of myDHT.table) {
        if (
          peer.node.peerID &&
          singleton.XORing(myID, singleton.Hex2Bin(peer.node.peerID)) <
            singleton.XORing(myID, singleton.Hex2Bin(closestPeer))
        ) {
          closestPeer = peer.node.peerID;
        }
      }

      console.log(closestPeer);

      // Find info about closest peer
      let closestConn = myDHT.table.find(
        (obj) => obj.node.peerID == closestPeer
      );

      // Send a search packet to the closest peer
      let closestSock = new net.Socket();
      closestSock.connect(
        closestConn.node.peerPort + 10000,
        closestConn.node.peerIP,
        () => {
          console.log(
            `Sending kadPTP request message to ${closestConn.node.peerIP}:${closestConn.node.peerPort}`
          );
          // Build a search packet
          kadPTPrequest.init(
            7,
            3,
            senderPeerInfo.name,
            senderPeerInfo,
            imageFullName
          );
          closestSock.write(kadPTPrequest.getBytePacket());
        }
      );

      // Recieve image data
      closestSock.on("data", (imageData) => {
        sock.write(imageData);
        sock.end();
      });
    }
  });
}

function updateDHTtable(DHTtable, list) {
  // Refresh the local k-buckets using the transmitted list of peers.
  refreshBucket(DHTtable, list);
  console.log("Refresh k-Bucket operation is performed.\n");

  if (DHTtable.table.length > 0) {
    let output = "My DHT: ";
    for (var i = 0; i < DHTtable.table.length; i++) {
      output +=
        "[" +
        DHTtable.table[i].node.peerIP +
        ":" +
        DHTtable.table[i].node.peerPort +
        ", " +
        DHTtable.table[i].node.peerID +
        "]\n        ";
    }
    console.log(output);
  }
}

function parseMessage(message) {
  let kadPacket = {};
  peersList = [];
  let bitMarker = 0;
  kadPacket.version = parseBitPacket(message, 0, 4);
  bitMarker += 4;
  kadPacket.msgType = parseBitPacket(message, 4, 8);
  bitMarker += 8;
  let numberOfPeers = parseBitPacket(message, 12, 8);
  bitMarker += 8;
  let SenderNameSize = parseBitPacket(message, 20, 12);
  bitMarker += 12;
  kadPacket.senderName = bytes2string(message.slice(4, SenderNameSize + 4));
  bitMarker += SenderNameSize * 8;

  if (numberOfPeers > 0) {
    for (var i = 0; i < numberOfPeers; i++) {
      let firstOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let secondOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let thirdOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let forthOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let port = parseBitPacket(message, bitMarker, 16);
      bitMarker += 16;
      let IP =
        firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;
      let peerID = singleton.getPeerID(IP, port);
      let aPeer = {
        peerIP: IP,
        peerPort: port,
        peerID: peerID,
      };
      peersList.push(aPeer);
    }
  }
  kadPacket.peersList = peersList;
  return kadPacket;
}

// Function to parse the kadPTP search packet
function parseRequest(message) {
  let kadPTPrequest = {};
  let bitMarker = 0;

  kadPTPrequest.version = parseBitPacket(message, 0, 4);
  bitMarker += 4;
  kadPTPrequest.msgType = parseBitPacket(message, 4, 8);
  bitMarker += 8;
  kadPTPrequest.senderNameLength = parseBitPacket(message, 20, 12);
  bitMarker += 20;

  kadPTPrequest.senderName = bytes2string(
    message.slice(4, kadPTPrequest.senderNameLength + 4)
  );
  bitMarker += kadPTPrequest.senderNameLength * 8;

  let firstOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  let secondOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  let thirdOctet = parseBitPacket(message, bitMarker, 8);
  bitMarker += 8;
  let forthOctet = parseBitPacket(message, bitMarker, 8);
  kadPTPrequest.ogIP =
    firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;

  kadPTPrequest.imageSock = parseBitPacket(message, 104, 16);

  let imageExtension = {
    1: "BMP",
    2: "JPEG",
    3: "GIF",
    4: "PNG",
    5: "TIFF",
    15: "RAW",
  };
  let imageType = parseBitPacket(message, 128, 4);
  kadPTPrequest.imageType = imageExtension[imageType];

  kadPTPrequest.imageNameSize = parseBitPacket(message, 132, 28);
  kadPTPrequest.imageName = bytes2string(
    message.slice(20, 20 + kadPTPrequest.imageNameSize)
  );

  return kadPTPrequest;
}

function refreshBucket(T, peersList) {
  peersList.forEach((P) => {
    pushBucket(T, P);
  });
}

// pushBucket method stores the peer’s information (IP address, port number, and peer ID)
// into the appropriate k-bucket of the DHTtable.
function pushBucket(T, P) {
  // First make sure that the given peer is not the loacl peer itself, then
  // determine the prefix i which is the maximum number of the leftmost bits shared between
  // peerID the owner of the DHTtable and the given peer ID.

  if (T.owner.peerID != P.peerID) {
    let localID = singleton.Hex2Bin(T.owner.peerID);
    let receiverID = singleton.Hex2Bin(P.peerID);
    // Count how many bits match
    let i = 0;
    for (i = 0; i < localID.length; i++) {
      if (localID[i] != receiverID[i]) break;
    }

    let k_bucket = {
      prefix: i,
      node: P,
    };

    let exist = T.table.find((e) => e.prefix === i);
    if (exist) {
      // insert the closest
      if (
        singleton.XORing(localID, singleton.Hex2Bin(k_bucket.node.peerID)) <
        singleton.XORing(localID, singleton.Hex2Bin(exist.node.peerID))
      ) {
        // remove the existing one
        for (var k = 0; k < T.table.length; k++) {
          if (T.table[k].node.peerID == exist.node.peerID) {
            console.log(
              "** The peer " +
                exist.node.peerID +
                " is removed and\n** The peer " +
                k_bucket.node.peerID +
                " is added instead"
            );
            T.table.splice(k, 1);
            break;
          }
        }
        // add the new one
        T.table.push(k_bucket);
      }
    } else {
      T.table.push(k_bucket);
    }
  }
}
// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time.
function sendHello(T) {
  let i = 0;
  // we use echoPeer method to do recursive method calls
  echoPeer(T, i);
}

// This method call itself (T.table.length) number of times,
// each time it sends hello messags to all peers in T
function echoPeer(T, i) {
  setTimeout(() => {
    let sock = new net.Socket();
    sock.connect(
      {
        port: T.table[i].node.peerPort,
        host: T.table[i].node.peerIP,
        localPort: T.owner.peerPort,
      },
      () => {
        // send Hello packet
        kadPTPpacket.init(7, 2, T);
        sock.write(kadPTPpacket.getPacket());
        setTimeout(() => {
          sock.end();
          sock.destroy();
        }, 500);
      }
    );
    sock.on("close", () => {
      i++;
      if (i < T.table.length) {
        echoPeer(T, i);
      }
    });
    if (i == T.table.length - 1) {
      console.log("Hello packet has been sent.\n");
    }
  }, 500);
}

function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    if (array[i] > 0) result += String.fromCharCode(array[i]);
  }
  return result;
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}
