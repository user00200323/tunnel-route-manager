# RotaDomínios VPS Agent

This is a lightweight HTTP agent that runs on VPS servers to enable remote management of Caddy configurations and Docker services from the RotaDomínios control panel.

## Installation

1. Copy the agent files to your VPS:
```bash
scp -r vps-agent/ root@your-vps-ip:/tmp/
```

2. SSH into your VPS and run the installer:
```bash
ssh root@your-vps-ip
cd /tmp/vps-agent
chmod +x install.sh
sudo ./install.sh
```

3. The installer will:
   - Install Python 3 and Flask
   - Create a dedicated `vps-agent` user
   - Generate a secure authentication token
   - Set up a systemd service
   - Start the agent on port 8888

4. Save the generated `VPS_AGENT_TOKEN` - you'll need to add it to your control panel configuration.

## Configuration

The agent expects:
- Docker and Docker Compose to be installed
- Application files in `/opt/app/`
- Caddyfile at `/opt/app/Caddyfile`
- Docker Compose file at `/opt/app/docker-compose.yml`

## API Endpoints

All endpoints require authentication via `Authorization: Bearer <token>` header.

### Health Check
- `GET /health` - Returns agent status

### Caddy Management
- `POST /update-caddy` - Update Caddyfile and reload Caddy
- `POST /reload-caddy` - Restart Caddy service

### Service Management
- `POST /restart-services` - Restart all Docker services
- `POST /restart-tunnel` - Restart Cloudflare tunnel
- `POST /status` - Get Docker services status

### Deployment
- `POST /deploy` - Execute deployment script
- `POST /setup` - Initial VPS setup with Docker Compose and Caddyfile

## Security

- The agent runs as a non-root user (`vps-agent`)
- All API calls require token authentication
- Commands are executed with 60-second timeout
- Only specific, predefined operations are allowed

## Logs

View agent logs:
```bash
journalctl -u vps-agent -f
```

## Troubleshooting

1. **Service not starting**: Check logs with `journalctl -u vps-agent`
2. **Permission errors**: Ensure vps-agent user is in docker group
3. **Connection refused**: Check if port 8888 is open in firewall
4. **Docker errors**: Ensure Docker is running and accessible

## Manual Service Control

```bash
# Start service
sudo systemctl start vps-agent

# Stop service
sudo systemctl stop vps-agent

# Restart service
sudo systemctl restart vps-agent

# Check status
sudo systemctl status vps-agent
```