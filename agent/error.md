# Error Log

## 2026-02-02 - ISSUE RESOLVED ✅

### Problem
Ollama was failing to start and using CPU instead of GPU (gfx1151 Strix Halo not detected).

### Root Cause
Missing configuration for AMD Strix Halo (RDNA 3.5 / gfx1151):
- Missing `privileged: true` mode
- Missing `HSA_OVERRIDE_GFX_VERSION=11.5.1`
- Missing `ipc: host` and security options

### Solution Applied
Based on working ComfyUI Strix Halo configuration from:
https://github.com/hector-oviedo/comfyui-strix-docker

Updated docker-compose.yml with:
- `privileged: true` (REQUIRED for GPU access)
- `HSA_OVERRIDE_GFX_VERSION=11.5.1` (Strix Halo architecture)
- `ipc: host` and `seccomp:unconfined`
- `HIP_VISIBLE_DEVICES=0`
- Group IDs via .env (VIDEO_GID=44, RENDER_GID=991)

### Verification
- ✅ GPU detected: `library=ROCm compute=gfx1151`
- ✅ Inference works: llama3.2 test successful
- 🔄 gpt-oss:20b downloading (13.8GB)

### Next Steps
Wait for gpt-oss:20b download, then start backend and frontend.
