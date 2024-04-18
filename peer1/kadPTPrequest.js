// Sufyan Khan
// 2023/10/04

//size of the search packet:
let HEADER_SIZE = 16;

//Fields that compose the ITP header
let version, messageType;

module.exports = {
  searchHeader: "", //Bitstream of the search packet
  payloadSize: 0, //size of the image payload
  payload: "", //Bitstream of the image payload

  init: function (ver, msgType, senderName, ogPeer, fullImageName) {
    //fill by default packet fields:
    version = ver;
    messageType = msgType;

    //build the header bistream:
    //--------------------------
    this.searchHeader = new Buffer.alloc(HEADER_SIZE);

    //fill the header array of bytes
    // v
    storeBitPacket(this.searchHeader, version * 1, 0, 4);
    // message type
    storeBitPacket(this.searchHeader, messageType, 4, 8);

    // Sender name length
    storeBitPacket(this.searchHeader, senderName.length, 20, 12);

    let sName = stringToBytes(senderName);

    // Sender Name
    let j = 0;
    let i = 0;
    for (i = 4; i < 4 + sName.length; i++) {
      this.searchHeader[i] = Buffer.from(sName)[j];
      j++;
    }

    // Originating peer's IP address
    let bitMarker = i * 8;
    let ogIP = ogPeer.ip;
    let firstOctet = ogIP.split(".")[0];
    let secondOctet = ogIP.split(".")[1];
    let thirdOctet = ogIP.split(".")[2];
    let forthOctet = ogIP.split(".")[3];

    storeBitPacket(this.searchHeader, firstOctet * 1, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(this.searchHeader, secondOctet, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(this.searchHeader, thirdOctet, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(this.searchHeader, forthOctet, bitMarker, 8);

    // Originating peer's image socket port number
    storeBitPacket(this.searchHeader, ogPeer.imageSock, 104, 16);

    if (fullImageName) {
      let imageExtension = {
        BMP: 1,
        JPEG: 2,
        GIF: 3,
        PNG: 4,
        TIFF: 5,
        RAW: 15,
      };
      imageName = stringToBytes(fullImageName.split(".")[0]);
      imageType = imageExtension[fullImageName.split(".")[1].toUpperCase()];

      this.payloadSize = 32 + imageName.length;
      this.payload = new Buffer.alloc(this.payloadSize);

      // IT
      storeBitPacket(this.payload, imageType, 0, 4);
      //image name length
      storeBitPacket(this.payload, imageName.length, 4, 28);

      // image file name
      for (j = 0; j < imageName.length; j++) {
        this.payload[j + 4] = imageName[j];
      }
    }
  },

  //--------------------------
  //getBytePacket: returns the entire packet in bytes
  //--------------------------
  getBytePacket: function () {
    let packet = new Buffer.alloc(this.payload.length + HEADER_SIZE);
    //construct the packet = header + payload
    for (var Hi = 0; Hi < HEADER_SIZE; Hi++) packet[Hi] = this.searchHeader[Hi];
    for (var Pi = 0; Pi < this.payload.length; Pi++)
      packet[Pi + HEADER_SIZE] = this.payload[Pi];

    return packet;
  },
};

function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
}
