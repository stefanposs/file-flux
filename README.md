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

- Go 1.23 or higher
- ngrok (optional, for public exposure)  
- Necessary environment variables/configuration set up

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

Configuration settings are managed through environment variables or a configuration file.  
The `Config` struct in `pkg/config/config.go` handles loading these settings.

### ngrok Integration (Optional)

To expose your backend server to the public internet using ngrok, follow these steps:

1. **Installation:**  
   Download and install ngrok from [ngrok.com](https://ngrok.com/).

2. **Authentication:**  
   Set up your ngrok auth token either as an environment variable:
   ```bash
   export NGROK_AUTHTOKEN=your_auth_token
   ```
   or (optional) create an `ngrok.yml` file in your workspace root:
   ```yaml
   authtoken: your_auth_token
   ```
   *Note: A separate config file for ngrok is not required if you set the environment variable.*

3. **Usage:**  
   When you start the backend (see below), ngrok will automatically be started via a subprocess. The public URL is then retrieved from ngrok's local API (http://localhost:4040/api/tunnels) and logged. Use this URL in your client's `server_url` setting (see client configuration below).

### Running the Server

To run the backend server, execute the following command from the `backend` directory:
```bash
go run cmd/main.go
```
The server will start listening on the configured port. If ngrok is enabled, its public URL will be output to your logs (e.g., `ngrok tunnel started: https://1234abcd.ngrok.io`).

### Running the Client

To run the client, execute the following command from the `client` directory:
```bash
go run cmd/main.go
```
The client monitors the local `uploads` folder for new files. When a file is detected:
- It is automatically uploaded to the server using long polling.
- The client then downloads the file from the server into the local `downloads` folder.
- Finally, the original file from `uploads` is deleted.

Ensure your client configuration (in `client/pkg/config/config.yml`) uses the correct server URL – for example, the ngrok URL if you want external access:
```yaml
server_url: "https://1234abcd.ngrok.io"
upload_dir: "./uploads"
download_dir: "./downloads"
```

### Example Usage

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
err = client.LongPollingDownloadFile("file.txt", cfg.DownloadDir)
if err != nil {
    log.Fatalf("Error downloading file: %v", err)
}
fmt.Println("File downloaded successfully.")
```

## License

This project is licensed under the MIT License. See the LICENSE file for more details.