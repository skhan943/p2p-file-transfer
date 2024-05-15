# Kademlia P2P File Transfer Demo

This project demonstrates a file transfer system within a Kademlia peer-to-peer (P2P) network. The system allows peers to join the network, share files, and request files from other peers. The implementation includes functionalities for handling peer connections, file transfer requests, and maintaining the Distributed Hash Table (DHT) used by the Kademlia protocol.

## Features

- **Peer-to-Peer Connections**: Establish connections between multiple peers.
- **File Transfer**: Transfer image files between peers using the Kademlia protocol.
- **DHT Maintenance**: Maintain and update the Distributed Hash Table for efficient file lookup.
- **Search and Retrieval**: Search for files across the network and retrieve them from the closest peer.

## Overview of Kademlia and the File Transfer System
What is Kademlia?
Kademlia is a distributed hash table (DHT) protocol that provides a decentralized and efficient way to store and retrieve key-value pairs across a peer-to-peer (P2P) network. Key concepts include:
- `Node ID`: Each node is assigned a unique identifier.
- `Distance Metric`: Uses XOR for distance calculation between node IDs and keys, facilitating routing decisions.
- `K-Buckets`: Each node maintains routing tables with k-buckets, storing contact information for other nodes based on their distance.
- `Lookup Process`: Recursive lookup procedure to find the node responsible for a specific key.

#### Starting a Peer:
When a new node (peer) starts up, it sets up its own address book (DHT table) and gets ready to connect to the network. The peer can either work alone or connect to a friend (known peer) who is already in the network.

#### Joining the Network:
When the peer connects to a friend, they share their address books. This means the peer updates its address book with information about new friends (other nodes). This process ensures that the peer knows how to find other friends in the network, integrating itself into the larger group.

#### File Storage:
Peers store files, similar to saving a picture on your phone. Each file gets a unique name (key), often a hash like SHA-1, which helps in finding the file later. Information about where the file is stored is saved in the address book (DHT) so other peers can find it when needed.

#### File Search and Retrieval:
When a peer wants a file, it initiates a search by sending a request for the file’s unique name (key). This request travels through the network, hopping from friend to friend, getting closer to the peer that has the file. Once a peer with the file is found, it sends the file back to the requesting peer.

**Click [here](https://www.youtube.com/watch?v=uPcfkwZq3TE) to see a quick demo of the file transfers taking place.**

## Getting Started

### Prerequisites

- Node.js (v12.x or higher)

### Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/p2p-file-transfer.git
    cd p2p-file-transfer
    ```

2. Install the required dependencies:
    ```bash
    npm install
    ```

## Running the Project

### Starting a Peer

1. To start a peer, run the following command:
    ```bash
    node KADpeerDB.js
    ```

2. To start a peer and connect to a known peer, run:
    ```bash
    node KADpeerDB.js -p <known-peer-ip>:<known-peer-port>
    ```

### Project Structure

- `ClientsHandler.js`: Handles incoming client connections and requests.
- `ITPResponse.js`: Manages the ITP response packets for file transfer.
- `KADpeerDB.js`: Main script for starting a peer and handling peer connections.
- `kadPTPmessage.js`: Manages the PTP message packets.
- `kadPTPrequest.js`: Handles the PTP request packets.
- `PeersHandler.js`: Manages peer connections and DHT updates.
- `Singleton.js`: Utility functions and singleton instance management.

### Example Usage

1. Start a peer without connecting to any known peer:
    ```bash
    node KADpeerDB.js
    ```

2. Start another peer and connect it to the first peer:
    ```bash
    node KADpeerDB.js -p 127.0.0.1:2001
    ```

3. Request a file from a peer:
    - This is handled automatically by the system when a file is requested by a peer.
