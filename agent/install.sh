#!/bin/bash

# Farben für den Terminal-Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Standardwerte
INSTALL_DIR="/opt/fileflux-agent"
CONFIG_DIR="/etc/fileflux-agent"
SERVICE_NAME="fileflux-agent"
DOWNLOAD_URL="https://download.fileflux.example.com/fileflux-agent-linux"

# Hilfe-Anzeige
show_help() {
    echo "FileFlux Agent Installation Script"
    echo ""
    echo "Verwendung: $0 [Optionen]"
    echo ""
    echo "Optionen:"
    echo "  -t, --token TOKEN        Agent-Token für die Verbindung zum Server"
    echo "  -s, --server URL         WebSocket-URL des FileFlux-Servers (z.B. ws://fileflux.example.com:3002/ws/agent)"
    echo "  -n, --name NAME          Name des Agenten (Standard: Hostname)"
    echo "  -d, --dir DIRECTORY      Installationsverzeichnis (Standard: $INSTALL_DIR)"
    echo "  -h, --help               Diese Hilfe anzeigen"
    echo ""
}

# Kommandozeilenparameter parsen
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -t|--token)
            TOKEN="$2"
            shift
            shift
            ;;
        -s|--server)
            SERVER_URL="$2"
            shift
            shift
            ;;
        -n|--name)
            AGENT_NAME="$2"
            shift
            shift
            ;;
        -d|--dir)
            INSTALL_DIR="$2"
            shift
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unbekannte Option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Prüfe, ob Token angegeben wurde
if [ -z "$TOKEN" ]; then
    echo -e "${RED}Fehler: Token muss angegeben werden (-t, --token)${NC}"
    show_help
    exit 1
fi

# Prüfe, ob Server-URL angegeben wurde
if [ -z "$SERVER_URL" ]; then
    echo -e "${RED}Fehler: Server-URL muss angegeben werden (-s, --server)${NC}"
    show_help
    exit 1
fi

# Standardwert für Agentennamen ist der Hostname
if [ -z "$AGENT_NAME" ]; then
    AGENT_NAME=$(hostname)
fi

# Root-Rechte prüfen
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Dieses Skript muss als root ausgeführt werden${NC}"
    exit 1
fi

echo -e "${GREEN}Starte Installation des FileFlux-Agenten...${NC}"

# Verzeichnisse erstellen
echo "Erstelle Verzeichnisse..."
mkdir -p $INSTALL_DIR
mkdir -p $CONFIG_DIR
mkdir -p /var/lib/fileflux-agent/data
mkdir -p /var/log/fileflux-agent
mkdir -p /tmp/fileflux-agent

# Binary herunterladen
echo "Lade Agent-Binary herunter..."
curl -sSL $DOWNLOAD_URL -o $INSTALL_DIR/fileflux-agent
chmod +x $INSTALL_DIR/fileflux-agent

# Konfigurationsdatei erstellen
echo "Erstelle Konfigurationsdatei..."
cat > $CONFIG_DIR/config.yaml << EOL
agent:
  name: "$AGENT_NAME"
  type: "client"
  description: "Installiert via Installationsskript"

connection:
  server_url: "$SERVER_URL"
  token: "$TOKEN"
  heartbeat_interval: 60
  reconnect_attempts: 5
  reconnect_delay: 10

transfers:
  chunk_size: 8
  concurrent_transfers: 3
  compression: true
  temp_dir: "/tmp/fileflux-agent"
  base_dir: "/var/lib/fileflux-agent/data"

logging:
  level: "info"
  file: "/var/log/fileflux-agent/fileflux-agent.log"
  max_size: 10
  max_backups: 3
  max_age: 7
EOL

# Systemd-Service erstellen
echo "Erstelle Systemd-Service..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOL
[Unit]
Description=FileFlux Agent
After=network.target

[Service]
ExecStart=$INSTALL_DIR/fileflux-agent --config $CONFIG_DIR/config.yaml
Restart=always
RestartSec=10
User=root
Group=root
Environment=PATH=/usr/bin:/usr/local/bin
WorkingDirectory=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOL

# Systemd neu laden und Service starten
echo "Aktiviere und starte den Service..."
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Installation prüfen
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}FileFlux Agent wurde erfolgreich installiert und gestartet!${NC}"
    echo -e "Agent-Name: ${YELLOW}$AGENT_NAME${NC}"
    echo -e "Server-URL: ${YELLOW}$SERVER_URL${NC}"
    echo -e "Konfigurationsdatei: ${YELLOW}$CONFIG_DIR/config.yaml${NC}"
    echo -e "Log-Datei: ${YELLOW}/var/log/fileflux-agent/fileflux-agent.log${NC}"
    echo -e "Service-Status: ${GREEN}Aktiv${NC}"
else
    echo -e "${RED}Installation abgeschlossen, aber der Service konnte nicht gestartet werden.${NC}"
    echo -e "Bitte überprüfen Sie die Logs mit: ${YELLOW}journalctl -u $SERVICE_NAME${NC}"
fi 