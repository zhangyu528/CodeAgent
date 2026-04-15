# Agent Trajectory Debugging

## Problem Statement

Debugging AI agent behavior is extremely difficult because agents are opaque black boxes. When CodeAgent makes a mistake or produces unexpected output, developers have no way to inspect the agent's reasoning chain, tool call sequence, and intermediate decisions. The existing DebugPanel only shows surface-level state, not the agent's "thought process."

## Recommended Direction

Add an **Agent Trajectory Recorder** that captures the complete decision tree of each agent session:
- Tool call sequence with arguments and results
- Model reasoning content (when available)
- Latency metrics per tool call
- Error propagation chain

Expose this via a new `/debug` slash command that replays the session in a structured, searchable timeline view.

## Key Assumptions to Validate

1. The pi-agent-core provides hooks or callbacks for tool call events
2. Model reasoning content is accessible in the response structure
3. The DebugPanel can be extended to show timeline visualization
4. Trajectory data can be stored in SQLite alongside existing session data

## MVP Scope

### In Scope
- Instrument the agent to emit trajectory events (tool_call_start, tool_call_end, reasoning_chunk, error)
- Store trajectory events in a new `trajectories` table in SQLite
- Add `/trajectory` slash command to open trajectory view in DebugPanel
- Basic timeline view showing tool call sequence with duration
- Export trajectory as JSON for external analysis

### Out of Scope
- Trajectory replay with state reconstruction (future work)
- Visualization graphs (charts, decision trees)
- Cloud upload / remote debugging
- Automatic bug detection / regression flags

## Not Doing (and Why)

- **Trajectory replay**: Would require full state serialization, too complex for MVP
- **Cloud upload**: Privacy concern; trajectory may contain sensitive file contents
- **Automatic bug detection**: Requires ML model to analyze trajectory, out of scope

## Open Questions

1. Does pi-agent-core expose tool call lifecycle events we can hook into?
2. How much storage will trajectory data consume per session? (Need to estimate)
3. Should trajectory recording be opt-in (default off) or always on?
4. Can we safely store tool arguments that might contain secrets?
