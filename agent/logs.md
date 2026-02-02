(base) hector@hector-NucBox-EVO-X2:~/workspace/open-research$ docker compose up --build -d ollama && sleep 3 && docker logs -f deepresearch-ollama
[+] up 3/3
 ✔ Network open-research_deepresearch-net Created                                                              0.1s
 ✔ Volume open-research_ollama_data       Created                                                              0.0s
 ✔ Container deepresearch-ollama          Created                                                              0.1s
Couldn't find '/root/.ollama/id_ed25519'. Generating new private key.
Your new public key is: 

ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDZHnH6oa+PNGpGMGEWeN7RXAL4rrSXNU6yGs79DasEr

time=2026-02-02T18:45:46.385Z level=INFO source=routes.go:1631 msg="server config" env="map[CUDA_VISIBLE_DEVICES: GGML_VK_VISIBLE_DEVICES: GPU_DEVICE_ORDINAL: HIP_VISIBLE_DEVICES:0 HSA_OVERRIDE_GFX_VERSION:11.5.1 HTTPS_PROXY: HTTP_PROXY: NO_PROXY: OLLAMA_CONTEXT_LENGTH:4096 OLLAMA_DEBUG:INFO OLLAMA_FLASH_ATTENTION:false OLLAMA_GPU_OVERHEAD:0 OLLAMA_HOST:http://0.0.0.0:11434 OLLAMA_KEEP_ALIVE:5m0s OLLAMA_KV_CACHE_TYPE: OLLAMA_LLM_LIBRARY: OLLAMA_LOAD_TIMEOUT:5m0s OLLAMA_MAX_LOADED_MODELS:1 OLLAMA_MAX_QUEUE:512 OLLAMA_MODELS:/root/.ollama/models OLLAMA_MULTIUSER_CACHE:false OLLAMA_NEW_ENGINE:false OLLAMA_NOHISTORY:false OLLAMA_NOPRUNE:false OLLAMA_NUM_PARALLEL:1 OLLAMA_ORIGINS:[http://localhost https://localhost http://localhost:* https://localhost:* http://127.0.0.1 https://127.0.0.1 http://127.0.0.1:* https://127.0.0.1:* http://0.0.0.0 https://0.0.0.0 http://0.0.0.0:* https://0.0.0.0:* app://* file://* tauri://* vscode-webview://* vscode-file://*] OLLAMA_REMOTES:[ollama.com] OLLAMA_SCHED_SPREAD:false OLLAMA_VULKAN:false ROCR_VISIBLE_DEVICES: http_proxy: https_proxy: no_proxy:]"
time=2026-02-02T18:45:46.385Z level=INFO source=images.go:473 msg="total blobs: 0"
time=2026-02-02T18:45:46.385Z level=INFO source=images.go:480 msg="total unused blobs removed: 0"
time=2026-02-02T18:45:46.385Z level=INFO source=routes.go:1684 msg="Listening on [::]:11434 (version 0.15.4)"
time=2026-02-02T18:45:46.385Z level=INFO source=runner.go:67 msg="discovering available GPUs..."
time=2026-02-02T18:45:46.385Z level=WARN source=runner.go:485 msg="user overrode visible devices" HIP_VISIBLE_DEVICES=0
time=2026-02-02T18:45:46.385Z level=WARN source=runner.go:485 msg="user overrode visible devices" HSA_OVERRIDE_GFX_VERSION=11.5.1
time=2026-02-02T18:45:46.385Z level=WARN source=runner.go:489 msg="if GPUs are not correctly discovered, unset and try again"
time=2026-02-02T18:45:46.385Z level=INFO source=server.go:429 msg="starting runner" cmd="/usr/bin/ollama runner --ollama-engine --port 34063"
time=2026-02-02T18:45:47.281Z level=INFO source=server.go:429 msg="starting runner" cmd="/usr/bin/ollama runner --ollama-engine --port 33119"
time=2026-02-02T18:45:47.922Z level=INFO source=types.go:42 msg="inference compute" id=0 filter_id=0 library=ROCm compute=gfx1151 name=ROCm0 description="AMD Radeon Graphics" libdirs=ollama,rocm driver=60342.13 pci_id=0000:c5:00.0 type=iGPU total="103.0 GiB" available="102.2 GiB"
