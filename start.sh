#!/bin/bash

# =============================================================================
# Deep Research System - Launch Script
# =============================================================================
# Usage: ./start.sh [command]
# Commands:
#   up          - Start all services (default)
#   down        - Stop all services
#   restart     - Restart all services
#   logs        - View logs
#   pull-model  - Pull GPT OSS 20B model
#   status      - Check service status
#   clean       - Remove all data and rebuild
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MODEL_NAME="gpt-oss:20b"
COMPOSE_FILE="docker-compose.yml"

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}║         🧠 Deep Research System - Launch Script              ║${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Command Functions
# =============================================================================

cmd_up() {
    print_banner
    print_info "Starting Deep Research System..."
    
    # Check if docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_success ".env file created. Please review and update it if needed."
    fi
    
    # Build and start services
    print_info "Building and starting services..."
    docker compose -f $COMPOSE_FILE up --build -d
    
    print_success "Services started!"
    echo ""
    print_info "Waiting for services to be healthy..."
    sleep 5
    
    # Check if model needs to be pulled
    print_info "Checking if $MODEL_NAME model is available..."
    if ! docker exec deepresearch-ollama ollama list | grep -q "$MODEL_NAME"; then
        print_warning "Model $MODEL_NAME not found. Pulling now..."
        print_info "This may take a while (several GB download)..."
        docker exec -it deepresearch-ollama ollama pull $MODEL_NAME
        print_success "Model pulled successfully!"
    else
        print_success "Model $MODEL_NAME already available!"
    fi
    
    echo ""
    print_success "🚀 Deep Research System is ready!"
    echo ""
    echo -e "${CYAN}Services:${NC}"
    echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
    echo -e "  Backend API: ${GREEN}http://localhost:8000${NC}"
    echo -e "  API Docs: ${GREEN}http://localhost:8000/custom-docs${NC}"
    echo -e "  Ollama: ${GREEN}http://localhost:11434${NC}"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo -e "  View logs: ${YELLOW}./start.sh logs${NC}"
    echo -e "  Stop: ${YELLOW}./start.sh down${NC}"
    echo -e "  Status: ${YELLOW}./start.sh status${NC}"
    echo ""
}

cmd_down() {
    print_info "Stopping all services..."
    docker compose -f $COMPOSE_FILE down
    print_success "All services stopped!"
}

cmd_restart() {
    print_info "Restarting all services..."
    cmd_down
    sleep 2
    cmd_up
}

cmd_logs() {
    print_info "Showing logs (Ctrl+C to exit)..."
    docker compose -f $COMPOSE_FILE logs -f
}

cmd_pull_model() {
    print_banner
    print_info "Pulling $MODEL_NAME model..."
    
    if ! docker ps | grep -q "deepresearch-ollama"; then
        print_error "Ollama container is not running. Start services first with: ./start.sh up"
        exit 1
    fi
    
    docker exec -it deepresearch-ollama ollama pull $MODEL_NAME
    print_success "Model pulled successfully!"
}

cmd_status() {
    print_banner
    print_info "Checking service status..."
    echo ""
    
    docker compose -f $COMPOSE_FILE ps
    
    echo ""
    print_info "Health checks:"
    
    # Check Ollama
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "  Ollama: ${GREEN}✓ Online${NC}"
    else
        echo -e "  Ollama: ${RED}✗ Offline${NC}"
    fi
    
    # Check Backend
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "  Backend: ${GREEN}✓ Online${NC}"
    else
        echo -e "  Backend: ${RED}✗ Offline${NC}"
    fi
    
    # Check Frontend
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "  Frontend: ${GREEN}✓ Online${NC}"
    else
        echo -e "  Frontend: ${RED}✗ Offline${NC}"
    fi
    
    # Check Model
    if docker exec deepresearch-ollama ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
        echo -e "  Model ($MODEL_NAME): ${GREEN}✓ Available${NC}"
    else
        echo -e "  Model ($MODEL_NAME): ${YELLOW}⚠ Not Found${NC}"
    fi
    
    echo ""
}

cmd_clean() {
    print_warning "This will remove all containers, volumes, and data!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        print_info "Cleaning up..."
        docker compose -f $COMPOSE_FILE down -v --remove-orphans
        print_success "Cleanup complete!"
    else
        print_info "Cleanup cancelled."
    fi
}

# =============================================================================
# Main
# =============================================================================

COMMAND=${1:-up}

case $COMMAND in
    up|start)
        cmd_up
        ;;
    down|stop)
        cmd_down
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs
        ;;
    pull-model)
        cmd_pull_model
        ;;
    status)
        cmd_status
        ;;
    clean)
        cmd_clean
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  up          Start all services (default)"
        echo "  down        Stop all services"
        echo "  restart     Restart all services"
        echo "  logs        View logs"
        echo "  pull-model  Pull GPT OSS 20B model"
        echo "  status      Check service status"
        echo "  clean       Remove all data and rebuild"
        echo ""
        exit 1
        ;;
esac
