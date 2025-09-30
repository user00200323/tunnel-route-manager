#!/usr/bin/env python3
"""
Simple VPS Agent for RotaDomínios
Handles remote Caddyfile management and service control via HTTP API
"""

import os
import json
import subprocess
from flask import Flask, request, jsonify
from functools import wraps
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Configuration
AGENT_TOKEN = os.getenv('VPS_AGENT_TOKEN', 'default-token')
APP_DIR = '/opt/app'
CADDYFILE_PATH = f'{APP_DIR}/Caddyfile'

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        token = auth_header.split(' ')[1]
        if token != AGENT_TOKEN:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated

def run_command(command, cwd=None):
    """Execute shell command and return result"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            cwd=cwd or APP_DIR,
            timeout=60
        )
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'Command timed out'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'agent': 'vps-agent',
        'version': '1.0.0'
    })

@app.route('/update-caddy', methods=['POST'])
@require_auth
def update_caddy():
    """Update Caddyfile and reload Caddy"""
    try:
        data = request.get_json()
        domains = data.get('domains', [])
        caddyfile = data.get('caddyfile', '')
        
        logging.info(f"Updating Caddyfile with domains: {domains}")
        
        # Ensure app directory exists
        os.makedirs(APP_DIR, exist_ok=True)
        
        # Write new Caddyfile
        with open(CADDYFILE_PATH, 'w') as f:
            f.write(caddyfile)
        
        # Reload Caddy
        reload_result = run_command('docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile')
        
        if not reload_result['success']:
            return jsonify({
                'success': False,
                'error': 'Failed to reload Caddy',
                'details': reload_result
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Caddyfile updated and Caddy reloaded successfully',
            'domains': domains
        })
        
    except Exception as e:
        logging.error(f"Error updating Caddy: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/reload-caddy', methods=['POST'])
@require_auth
def reload_caddy():
    """Reload Caddy service"""
    try:
        result = run_command('docker compose restart caddy')
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': 'Failed to reload Caddy',
                'details': result
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Caddy reloaded successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/restart-services', methods=['POST'])
@require_auth
def restart_services():
    """Restart all Docker services"""
    try:
        result = run_command('docker compose restart')
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': 'Failed to restart services',
                'details': result
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'All services restarted successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/restart-tunnel', methods=['POST'])
@require_auth
def restart_tunnel():
    """Restart Cloudflare tunnel"""
    try:
        result = run_command('docker compose restart cloudflared')
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': 'Failed to restart tunnel',
                'details': result
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Cloudflare tunnel restarted successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/deploy', methods=['POST'])
@require_auth
def deploy():
    """Execute deployment"""
    try:
        data = request.get_json()
        commit_sha = data.get('commitSha', 'latest')
        
        # Run deploy script
        deploy_result = run_command('./deploy.sh')
        if not deploy_result['success']:
            return jsonify({
                'success': False,
                'error': 'Deploy script failed',
                'details': deploy_result
            }), 500
        
        # Update containers
        update_result = run_command('docker compose up -d --pull always')
        if not update_result['success']:
            return jsonify({
                'success': False,
                'error': 'Failed to update containers',
                'details': update_result
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Deployment completed successfully',
            'commitSha': commit_sha
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/setup', methods=['POST'])
@require_auth
def setup():
    """Initial VPS setup"""
    try:
        data = request.get_json()
        domains = data.get('domains', [])
        docker_compose = data.get('dockerCompose', '')
        caddyfile = data.get('caddyfile', '')
        
        # Create app directory
        os.makedirs(APP_DIR, exist_ok=True)
        
        # Write docker-compose.yml
        with open(f'{APP_DIR}/docker-compose.yml', 'w') as f:
            f.write(docker_compose)
        
        # Write Caddyfile
        with open(CADDYFILE_PATH, 'w') as f:
            f.write(caddyfile)
        
        # Create deploy script
        deploy_script = '''#!/bin/bash
set -e
echo "Starting deployment..."
git pull origin main || echo "No git repository found"
echo "Deployment completed"
'''
        with open(f'{APP_DIR}/deploy.sh', 'w') as f:
            f.write(deploy_script)
        
        # Make deploy script executable
        os.chmod(f'{APP_DIR}/deploy.sh', 0o755)
        
        # Start services
        start_result = run_command('docker compose up -d')
        if not start_result['success']:
            return jsonify({
                'success': False,
                'error': 'Failed to start services',
                'details': start_result
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'VPS setup completed successfully',
            'domains': domains
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/status', methods=['POST'])
@require_auth
def status():
    """Check status of services"""
    try:
        result = run_command('docker compose ps --format json')
        
        return jsonify({
            'success': True,
            'message': 'Status checked successfully',
            'services': result['stdout']
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/exec-command', methods=['POST'])
@require_auth
def exec_command():
    """Execute safe commands on the VPS"""
    try:
        data = request.get_json()
        command = data.get('command')
        
        if not command:
            return jsonify({
                'success': False,
                'error': 'Command is required'
            }), 400
        
        # Security: Only allow specific safe commands
        allowed_commands = [
            'sed -n \'1,120p\' /opt/app/Caddyfile',
            'cat /opt/app/docker-compose.yml',
            'ls -la /opt/app/',
            'docker compose ps',
            'docker compose ps --format json'
        ]
        
        # Allow backup commands with timestamp
        if command.startswith('cp /opt/app/Caddyfile /opt/app/Caddyfile.bak.'):
            allowed_commands.append(command)
        
        if command not in allowed_commands:
            return jsonify({
                'success': False,
                'error': f'Command not allowed: {command}'
            }), 403
        
        logger.info(f"Executing command: {command}")
        result = run_command(command, cwd=APP_DIR)
        
        return jsonify({
            'success': result['success'],
            'output': result['stdout'] if result['success'] else None,
            'error': result['stderr'] if not result['success'] else None
        })
        
    except Exception as e:
        logger.error(f"Exec command endpoint error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Production setup
    app.run(host='0.0.0.0', port=8888, debug=False)