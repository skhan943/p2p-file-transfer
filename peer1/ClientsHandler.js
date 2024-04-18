// Sufyan Khan
// 2023/10/04

var ITPpacket = require("./ITPResponse"),
  singleton = require("./Singleton");
const fs = require("fs");
const kadPTPrequest = require("./kadPTPrequest");
const net = require("net");

var nickNames = {},
  clientIP = {},
  startTimestamp = {};

module.exports = {
  handleClientJoining: function (sock, senderPeerInfo) {
    assignClientName(sock, nickNames);
    const chunks = [];
    console.log(
      "\n" +
        nickNames[sock.id] +
        " is connected at timestamp: " +
        startTimestamp[sock.id]
    );
    sock.on("data", function (requestPacket) {
      handleClientRequests(requestPacket, sock, senderPeerInfo); //read client requests and respond
    });
    sock.on("close", function () {
      handleClientLeaving(sock);
    });
  },
};

function handleClientRequests(data, sock, senderPeerInfo) {
  console.log("\nITP packet received:");
  printPacketBit(data);

  let version = parseBitPacket(data, 0, 4);
  let requestType = parseBitPacket(data, 24, 8);
  let requestName = {
    0: "Query",
    1: "Found",
    2: "Not found",
    3: "Busy",
  };
  let imageExtension = {
    1: "BMP",
    2: "JPEG",
    3: "GIF",
    4: "PNG",
    5: "TIFF",
    15: "RAW",
  };
  let timeStamp = parseBitPacket(data, 32, 32);
  let imageType = parseBitPacket(data, 64, 4);
  let imageTypeName = imageExtension[imageType];
  let imageNameSize = parseBitPacket(data, 68, 28);
  let imageName = bytesToString(data.slice(12, 13 + imageNameSize));

  console.log(
    "\n" +
      nickNames[sock.id] +
      " requests:" +
      "\n    --ITP version: " +
      version +
      "\n    --Timestamp: " +
      timeStamp +
      "\n    --Request type: " +
      requestName[requestType] +
      "\n    --Image file extension(s): " +
      imageTypeName +
      "\n    --Image file name: " +
      imageName +
      "\n"
  );
  if (version == 7) {
    let imageFullName = imageName + "." + imageTypeName;
    let imageData;
    try {
      imageData = fs.readFileSync(imageFullName);

      ITPpacket.init(
        version,
        1, // response type
        singleton.getSequenceNumber(), // sequence number
        singleton.getTimestamp(), // timestamp
        imageData // image data
      );

      sock.write(ITPpacket.getBytePacket());
      sock.end();
    } catch (err) {
      // Find the closest peer
      let closestPeer = senderPeerInfo.serverDHTtable[0].node.peerID;
      for (peer of senderPeerInfo.serverDHTtable) {
        if (
          peer.node.peerID &&
          singleton.XORing(
            senderPeerInfo.id,
            singleton.Hex2Bin(peer.node.peerID)
          ) <
            singleton.XORing(senderPeerInfo.id, singleton.Hex2Bin(closestPeer))
        ) {
          closestPeer = peer.node.peerID;
        }
      }

      // Find info about closest peer
      let closestConn = senderPeerInfo.serverDHTtable.find(
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
  } else {
    console.log("The protocol version is not supported");
    sock.end();
  }
}

function handleClientLeaving(sock) {
  console.log(nickNames[sock.id] + " closed the connection");
}

function assignClientName(sock, nickNames) {
  sock.id = sock.remoteAddress + ":" + sock.remotePort;
  startTimestamp[sock.id] = singleton.getTimestamp();
  var name = "Client-" + startTimestamp[sock.id];
  nickNames[sock.id] = name;
  clientIP[sock.id] = sock.remoteAddress;
}

function bytesToString(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

function bytes2number(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result ^= array[array.length - i - 1] << (8 * i);
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
// Prints the entire packet in bits format
function printPacketBit(packet) {
  var bitString = "";

  for (var i = 0; i < packet.length; i++) {
    // To add leading zeros
    var b = "00000000" + packet[i].toString(2);
    // To print 4 bytes per line
    if (i > 0 && i % 4 == 0) bitString += "\n";
    bitString += " " + b.substr(b.length - 8);
  }
  console.log(bitString);
}
