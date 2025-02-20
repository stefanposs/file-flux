# File Flux

## Overview

File Flux is a highly flexible, scalable, and secure File Transfer Service that automates the exchange of large data volumes between legacy systems, local data centers, and modern cloud environments. The solution is based on an event-driven architecture, enabling various applications to communicate in real-time – both in push and pull modes.

## Features

- **Bidirectional Data Transfer (Push & Pull)**
- **Event-Driven Architecture**
- **Efficient Data Compression and Optimization**
- **Flexible Protocol Support**
- **Central API Service & Monitoring**
- **Security & Compliance**

## Getting Started

### Prerequisites

- Go 1.16 or higher
- Any necessary environment variables set for configuration

### Installation

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd file-flux
    ```

2. Install the necessary dependencies:
    ```bash
    go mod tidy
    ```

### Configuration

Configuration settings are managed through environment variables or a configuration file. The `Config` struct in `pkg/config/config.go` handles loading these settings.

### Running the Server

To run the server, execute the following command from the `backend` directory:
```bash
go run cmd/main.go
```
The server will start listening for incoming requests on the specified port.

### Running the Client

To run the client, execute the following command from the `client` directory:
```bash
go run cmd/main.go
```
This will start the client, allowing you to interact with the backend API server.

### Example Usage

#### Upload a File

```bash
curl -X POST -F "file=@/path/to/your/file.txt" http://localhost:8080/upload
```

#### Download a File

```bash
curl -O http://localhost:8080/download/file-id
```

### Long Polling

#### Long Polling Upload

The client application demonstrates how to upload a file in chunks using long polling:
```go
err = client.LongPollingUploadFile(cfg.UploadDir + "/file.txt")
if err != nil {
     log.Fatalf("Error uploading file: %v", err)
}
fmt.Println("File uploaded successfully.")
```

#### Long Polling Download

The client application demonstrates how to download a file in chunks using long polling:
```go
err = client.LongPollingDownloadFile("file-id", cfg.DownloadDir)
if err != nil {
     log.Fatalf("Error downloading file: %v", err)
}
fmt.Println("File downloaded successfully.")
```

## License

This project is licensed under the MIT License. See the LICENSE file for more details.