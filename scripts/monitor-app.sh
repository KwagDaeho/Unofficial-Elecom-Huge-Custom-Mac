#!/bin/zsh
# Monitors the installed DMG app (elecom-huge) and accumulates logs for post-mortem analysis.
#   scripts/monitor-app.sh stop
#   scripts/monitor-app.sh status
#   scripts/monitor-app.sh tail    # follow events log
#
# Logs: ~/Library/Logs/Elecom Huge Custom/monitor/
#   metrics.csv     — app CPU/RSS (1/min)
#   sys-metrics.csv — system CPU/load/memory (1/min)

SCRIPT="${${(%):-%x}:A}"
[[ -f "$SCRIPT" ]] || SCRIPT="${0:A}"

emulate -L zsh
set -uo pipefail
setopt null_glob 2>/dev/null || true
unsetopt typeset_verbose 2>/dev/null || true

LOG_DIR="$HOME/Library/Logs/Elecom Huge Custom/monitor"
METRICS="$LOG_DIR/metrics.csv"
SYS_METRICS="$LOG_DIR/sys-metrics.csv"
EVENTS="$LOG_DIR/events.log"
FORENSICS="$LOG_DIR/forensics.log"
PIDFILE="$LOG_DIR/monitor.pid"
APP_BIN="/Applications/Elecom Huge Custom.app/Contents/MacOS/elecom-huge"
PANIC="$HOME/Library/Logs/Elecom Huge Custom/rust-panic.log"
CRASH_DIR="$HOME/Library/Logs/DiagnosticReports"

INTERVAL=10
METRIC_EVERY=6          # every 6 ticks ≈ 1 min
HIGH_CPU_PCT=12
HIGH_CPU_STREAK=3       # 3 ticks ≈ 30s
MEM_JUMP_MB=40
SYS_MEM_FREE_WARN=15    # system-wide free memory below this (%)
SYS_CPU_IDLE_WARN=10    # idle below this → system busy
SYS_LOAD_FACTOR=2       # load1 > ncpu * factor
SYS_STREAK=3            # ~30s sustained

mkdir -p "$LOG_DIR"

# Returns: cpu_user,cpu_sys,cpu_idle,load1,load5,load15,mem_free_pct,mem_used_mb,mem_total_mb,swap_used_mb
sample_system_metrics() {
  local cpu_user=0 cpu_sys=0 cpu_idle=0
  local load1=0 load5=0 load15=0
  local mem_free_pct=0 mem_used_mb=0 mem_total_mb=0 swap_used_mb=0

  local cpu_line="${(@f)$(top -l 1 -s 0 -n 0 2>/dev/null | grep 'CPU usage')}"
  if [[ -n "$cpu_line" ]]; then
    cpu_user=${${cpu_line#*usage: }%% user*}
    cpu_sys=${${cpu_line#*user, }%% sys*}
    cpu_idle=${${cpu_line#*sys, }%% idle*}
    cpu_user=${cpu_user//[^0-9.]/}
    cpu_sys=${cpu_sys//[^0-9.]/}
    cpu_idle=${cpu_idle//[^0-9.]/}
  fi

  local -a loads=(${(@s: :)$(sysctl -n vm.loadavg 2>/dev/null | tr -d '{}')})
  load1=${loads[1]:-0}
  load5=${loads[2]:-0}
  load15=${loads[3]:-0}

  mem_total_mb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1048576 ))
  mem_free_pct=$(memory_pressure 2>/dev/null | awk -F: '/System-wide memory free percentage/ {gsub(/[% ]/,"",$2); print $2}')
  [[ -z "$mem_free_pct" ]] && mem_free_pct=0
  if (( mem_total_mb > 0 && mem_free_pct >= 0 )); then
    mem_used_mb=$(( mem_total_mb * (100 - mem_free_pct) / 100 ))
  fi

  local swap_line=$(sysctl -n vm.swapusage 2>/dev/null)
  if [[ -n "$swap_line" ]]; then
    swap_used_mb=${${swap_line#*used = }%%M*}
    swap_used_mb=${swap_used_mb//[^0-9.]/}
  fi

  echo "$cpu_user,$cpu_sys,$cpu_idle,$load1,$load5,$load15,$mem_free_pct,$mem_used_mb,$mem_total_mb,$swap_used_mb"
}

capture_system_forensics() {
  echo "--- system snapshot ---"
  top -l 1 -s 0 -n 0 2>/dev/null | grep -E "CPU usage|PhysMem|Load Avg" || true
  sysctl vm.loadavg hw.memsize vm.swapusage 2>/dev/null || true
  memory_pressure 2>/dev/null | tail -5 || true
  echo "--- top CPU processes ---"
  top -l 1 -s 0 -n 10 -o cpu 2>/dev/null | tail -12 || true
  echo "--- top memory processes ---"
  top -l 1 -s 0 -n 10 -o mem 2>/dev/null | tail -12 || true
}

event() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$EVENTS"; }

rotate_if_large() {
  local file=$1 limit=${2:-5242880}
  [[ -f "$file" ]] || return 0
  local size=$(wc -c < "$file" | tr -d ' ')
  if (( size > limit )); then
    mv "$file" "${file}.1"
    event "ROTATE $(basename "$file") (${size} bytes)"
  fi
}

capture_forensics() {
  local reason=$1
  local pid=${2:-}
  rotate_if_large "$FORENSICS"
  {
    echo ""
    echo "========== $(date '+%Y-%m-%d %H:%M:%S') — $reason =========="
    echo "app=$APP_BIN"
    echo "pid=${pid:-unknown}"
    if [[ -n "$pid" ]]; then
      ps -p "$pid" -o pid,rss,vsz,pcpu,pmem,etime,state,command 2>/dev/null
      echo "--- threads ---"
      ps -M -p "$pid" 2>/dev/null | head -30
      echo "--- 5x 1s CPU/RSS ---"
      for _ in 1 2 3 4 5; do ps -p "$pid" -o pcpu=,rss= 2>/dev/null; sleep 1; done
      echo "--- open files (count) ---"
      lsof -p "$pid" 2>/dev/null | wc -l
    fi
    echo "--- USB/HID (elecom) ---"
    system_profiler SPUSBDataType 2>/dev/null | grep -iE "elecom|huge|056e" -A2 2>/dev/null | head -20 || echo "(none matched)"
    echo "--- crash reports ---"
    local -a cr
    cr=("${(@f)$(find "$CRASH_DIR" -maxdepth 1 \( -name 'elecom-huge*' -o -iname 'Elecom*Huge*' \) 2>/dev/null)}")
    if (( ${#cr} )); then ls -lt "${cr[@]}" 2>/dev/null | head -5; else echo "(none)"; fi
    echo "--- rust-panic.log ---"
    if [[ -f "$PANIC" ]]; then tail -30 "$PANIC"; else echo "(none)"; fi
    echo "--- unified log (last 2 min) ---"
    log show --predicate 'process == "elecom-huge"' --last 2m 2>/dev/null | tail -50 || echo "(unavailable)"
    capture_system_forensics
  } >> "$FORENSICS" 2>&1
  event "FORENSICS $reason → $FORENSICS"
}

run_loop() {
  [[ -f "$METRICS" ]] || echo "timestamp,pid,cpu_pct,rss_mb,threads,state" >> "$METRICS"
  [[ -f "$SYS_METRICS" ]] || echo "timestamp,cpu_user_pct,cpu_sys_pct,cpu_idle_pct,load_1,load_5,load_15,mem_free_pct,mem_used_mb,mem_total_mb,swap_used_mb" >> "$SYS_METRICS"

  local last_pid="" was_running=0 last_rss=0 cpu_streak=0 tick=0
  local last_crash="" last_panic_size=0 last_bundle=""
  local sys_load_streak=0 sys_cpu_streak=0 sys_mem_warn=0
  local ncpu=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
  local sys_load_limit=$(( ncpu * SYS_LOAD_FACTOR ))

  event "MONITOR_START interval=${INTERVAL}s log_dir=$LOG_DIR ncpu=$ncpu"

  while true; do
    rotate_if_large "$EVENTS"
    tick=$(( tick + 1 ))

    local bundle=""
    if [[ -f "/Applications/Elecom Huge Custom.app/Contents/Info.plist" ]]; then
      bundle=$(plutil -extract CFBundleShortVersionString raw -o - \
        "/Applications/Elecom Huge Custom.app/Contents/Info.plist" 2>/dev/null || echo "?")
    fi
    if [[ -n "$bundle" && "$bundle" != "$last_bundle" ]]; then
      event "APP_VERSION $bundle"
      last_bundle=$bundle
    fi

    local pid=$(pgrep -x elecom-huge 2>/dev/null | head -1)

    if [[ -z "$pid" ]]; then
      if [[ "$was_running" -eq 1 ]]; then
        event "EXIT last_pid=$last_pid last_rss=${last_rss}MB window~${INTERVAL}s"
        capture_forensics "process_exit" "$last_pid"
        was_running=0
        cpu_streak=0
        echo "$(date '+%Y-%m-%d %H:%M:%S'),0,0,0,0,exit" >> "$METRICS"
      fi

      if (( tick % METRIC_EVERY == 0 )); then
        local sys_line=$(sample_system_metrics)
        echo "$(date '+%Y-%m-%d %H:%M:%S'),$sys_line" >> "$SYS_METRICS"
        IFS=, read -r s_cpu_user s_cpu_sys s_cpu_idle s_load1 s_load5 s_load15 s_mem_free s_mem_used s_mem_total s_swap <<< "$sys_line"
        event "HEARTBEAT app=down | sys idle=${s_cpu_idle}% load=${s_load1}/${s_load5}/${s_load15} mem_free=${s_mem_free}% swap=${s_swap}MB"
      fi
    else
      local rss_kb=0 cpu=0 state='?' threads=0
      local ps_line=$(ps -p "$pid" -o rss=,pcpu=,state= 2>/dev/null | tr -s ' ')
      read rss_kb cpu state <<< "$ps_line"
      threads=$(ps -M -p "$pid" 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
      local rss_mb=$(( ${rss_kb:-0} / 1024 ))
      local cpu_int=${cpu%.*}
      [[ -z "$cpu_int" || "$cpu_int" == "" ]] && cpu_int=0
      [[ -z "$threads" ]] && threads=0
      [[ -z "$state" ]] && state="?"

      if [[ "$pid" != "$last_pid" && "$was_running" -eq 1 ]]; then
        event "RESTART old=$last_pid new=$pid"
        capture_forensics "pid_changed" "$pid"
      fi

      if (( cpu_int >= HIGH_CPU_PCT )); then
        cpu_streak=$(( cpu_streak + 1 ))
        event "HIGH_CPU pid=$pid cpu=${cpu}% rss=${rss_mb}MB threads=$threads streak=$cpu_streak"
        if (( cpu_streak >= HIGH_CPU_STREAK )); then
          capture_forensics "sustained_high_cpu" "$pid"
          cpu_streak=0
        fi
      else
        cpu_streak=0
      fi

      if [[ "$last_rss" -gt 0 && "$rss_mb" -gt $(( last_rss + MEM_JUMP_MB )) ]]; then
        event "MEM_JUMP pid=$pid rss=${rss_mb}MB was=${last_rss}MB"
        capture_forensics "memory_jump" "$pid"
      fi

      if (( tick % METRIC_EVERY == 0 )); then
        echo "$(date '+%Y-%m-%d %H:%M:%S'),$pid,$cpu,$rss_mb,$threads,$state" >> "$METRICS"

        local sys_line=$(sample_system_metrics)
        IFS=, read -r s_cpu_user s_cpu_sys s_cpu_idle s_load1 s_load5 s_load15 s_mem_free s_mem_used s_mem_total s_swap <<< "$sys_line"
        echo "$(date '+%Y-%m-%d %H:%M:%S'),$sys_line" >> "$SYS_METRICS"

        local s_cpu_idle_int=${s_cpu_idle%.*}
        local s_load1_int=${s_load1%.*}
        [[ -z "$s_cpu_idle_int" ]] && s_cpu_idle_int=100
        [[ -z "$s_load1_int" ]] && s_load1_int=0

        event "HEARTBEAT pid=$pid cpu=${cpu}% rss=${rss_mb}MB threads=$threads state=$state | sys idle=${s_cpu_idle}% load=${s_load1}/${s_load5}/${s_load15} mem_free=${s_mem_free}% swap=${s_swap}MB"

        if (( s_cpu_idle_int <= SYS_CPU_IDLE_WARN )); then
          sys_cpu_streak=$(( sys_cpu_streak + 1 ))
          event "SYS_HIGH_CPU idle=${s_cpu_idle}% user=${s_cpu_user}% sys=${s_cpu_sys}% streak=$sys_cpu_streak"
          if (( sys_cpu_streak >= SYS_STREAK )); then
            capture_forensics "system_high_cpu" "${pid:-}"
            sys_cpu_streak=0
          fi
        else
          sys_cpu_streak=0
        fi

        if (( s_load1_int >= sys_load_limit )); then
          sys_load_streak=$(( sys_load_streak + 1 ))
          event "SYS_HIGH_LOAD load1=${s_load1} limit=${sys_load_limit} streak=$sys_load_streak"
          if (( sys_load_streak >= SYS_STREAK )); then
            capture_forensics "system_high_load" "${pid:-}"
            sys_load_streak=0
          fi
        else
          sys_load_streak=0
        fi

        if (( s_mem_free <= SYS_MEM_FREE_WARN )); then
          if (( sys_mem_warn == 0 )); then
            event "SYS_LOW_MEM free=${s_mem_free}% used=${s_mem_used}MB total=${s_mem_total}MB swap=${s_swap}MB"
            capture_forensics "system_low_memory" "${pid:-}"
          fi
          sys_mem_warn=1
        else
          sys_mem_warn=0
        fi
      fi

      if [[ "$was_running" -eq 0 ]]; then
        event "APP_UP pid=$pid cpu=${cpu}% rss=${rss_mb}MB version=$bundle"
      fi

      was_running=1
      last_pid=$pid
      last_rss=$rss_mb
    fi

    if [[ -f "$PANIC" ]]; then
      local psz=$(wc -c < "$PANIC" | tr -d ' ')
      if (( psz > last_panic_size )); then
        event "RUST_PANIC updated ${psz} bytes"
        capture_forensics "rust_panic" "${pid:-}"
        last_panic_size=$psz
      fi
    fi

    local crash=""
    if [[ -d "$CRASH_DIR" ]]; then
      local -a crash_files
      crash_files=("${(@f)$(find "$CRASH_DIR" -maxdepth 1 \( -name 'elecom-huge*' -o -iname 'Elecom*Huge*' \) 2>/dev/null)}")
      if (( ${#crash_files} )); then
        crash=$(ls -t "${crash_files[@]}" 2>/dev/null | head -1)
      fi
    fi
    if [[ -n "$crash" && -f "$crash" && "$crash" != "$last_crash" ]]; then
      event "CRASH_REPORT $crash"
      capture_forensics "crash_report" "${pid:-}"
      last_crash=$crash
    fi

    sleep "$INTERVAL"
  done
}

cmd_start() {
  if [[ -f "$PIDFILE" ]]; then
    local old=$(cat "$PIDFILE" 2>/dev/null)
    if kill -0 "$old" 2>/dev/null; then
      echo "monitor already running (pid $old)"
      echo "logs: $LOG_DIR"
      exit 0
    fi
  fi
  mkdir -p "$LOG_DIR"
  nohup /bin/zsh -f "$SCRIPT" _loop >> "$LOG_DIR/monitor-stdout.log" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 0.5
  if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "monitor started pid=$(cat "$PIDFILE")"
  else
    echo "monitor failed to start — see $LOG_DIR/monitor-stdout.log"
    exit 1
  fi
  echo "logs: $LOG_DIR"
}

cmd_stop() {
  if [[ -f "$PIDFILE" ]]; then
    local old=$(cat "$PIDFILE")
    kill "$old" 2>/dev/null && event "MONITOR_STOP pid=$old" || true
    rm -f "$PIDFILE"
    echo "monitor stopped"
  else
    pkill -f "monitor-app.sh _loop" 2>/dev/null && echo "monitor stopped" || echo "monitor not running"
  fi
}

cmd_status() {
  local mpid=""
  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    mpid=$(cat "$PIDFILE")
    echo "monitor: running (pid $mpid, manual)"
  elif mpid=$(pgrep -f "monitor-app.sh _loop" 2>/dev/null | head -1); [[ -n "$mpid" ]]; then
    echo "monitor: running (pid $mpid, launchd)"
  else
    echo "monitor: not running"
  fi
  local apid=$(pgrep -x elecom-huge 2>/dev/null | head -1)
  if [[ -n "$apid" ]]; then
    ps -p "$apid" -o pid,pcpu,rss,etime,command 2>/dev/null
  else
    echo "app: not running"
  fi
  echo "logs: $LOG_DIR"
  ls -lh "$LOG_DIR" 2>/dev/null
  if [[ -f "$SYS_METRICS" ]]; then
    echo "system (latest):"
    tail -1 "$SYS_METRICS" 2>/dev/null
  fi
}

case "${1:-start}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  tail)   tail -f "$EVENTS" ;;
  _loop)  run_loop ;;
  *)      echo "usage: $0 {start|stop|status|tail}"; exit 1 ;;
esac
