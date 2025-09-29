#!/bin/bash
set -e

echo "=== RotaDomínios VPS Agent Installer ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root (using sudo)"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
apt-get update
apt-get install -y python3 python3-pip docker.io docker-compose

# Create agent user
if ! id "vps-agent" &>/dev/null; then
    echo "Creating vps-agent user..."
    useradd -r -s /bin/false -d /opt/vps-agent vps-agent
fi

# Create directories
echo "Setting up directories..."
mkdir -p /opt/vps-agent
mkdir -p /opt/app

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install flask

# Copy agent script
echo "Installing agent script..."
cp agent.py /opt/vps-agent/
chmod +x /opt/vps-agent/agent.py
chown -R vps-agent:vps-agent /opt/vps-agent

# Set up Docker permissions
usermod -aG docker vps-agent

# Generate random token if not provided
if [ -z "$VPS_AGENT_TOKEN" ]; then
    VPS_AGENT_TOKEN=$(openssl rand -hex 32)
    echo "Generated VPS_AGENT_TOKEN: $VPS_AGENT_TOKEN"
    echo "Please save this token - you'll need it to configure the control panel"
fi

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/vps-agent.service << EOF
[Unit]
Description=RotaDomínios VPS Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=vps-agent
WorkingDirectory=/opt/vps-agent
Environment=VPS_AGENT_TOKEN=$VPS_AGENT_TOKEN
ExecStart=/usr/bin/python3 /opt/vps-agent/agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "Starting VPS Agent service..."
systemctl daemon-reload
systemctl enable vps-agent
systemctl start vps-agent

# Check service status
sleep 2
if systemctl is-active --quiet vps-agent; then
    echo "✅ VPS Agent installed and running successfully!"
    echo "Service is listening on port 8888"
    echo ""
    echo "VPS_AGENT_TOKEN: $VPS_AGENT_TOKEN"
    echo ""
    echo "Add this token to your RotaDomínios control panel configuration."
else
    echo "❌ Failed to start VPS Agent service"
    echo "Check logs with: journalctl -u vps-agent -f"
    exit 1
fi

# Setup firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 8888/tcp
    echo "Firewall rule added for port 8888"
fi

echo ""
echo "=== Installation Complete ==="
echo "The VPS Agent is now running and ready to receive commands."
echo "Make sure to configure the VPS_AGENT_TOKEN in your control panel."