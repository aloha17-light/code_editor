import sys
import json
import os
import types

def sanitize_locals(local_vars):
    """
    Safely converts local variables into JSON-serializable formats, skipping
    modules, functions, and internal built-ins.
    """
    safe_locals = {}
    for key, value in local_vars.items():
        # Ignore Python internals or module imports
        if key.startswith('__') or key in ['np', 'pd']:
            continue
            
        if isinstance(value, (types.FunctionType, types.ModuleType, type)):
            continue

        try:
            # Check if it's natively serializable (int, string, list, dict without complex types inside)
            json.dumps(value)
            safe_locals[key] = value
        except (TypeError, OverflowError):
            # Fallback to string representation for complex objects (like numpy arrays)
            try:
                safe_locals[key] = str(value)
            except:
                safe_locals[key] = "<Unrepresentable Object>"
                
    return safe_locals

def execute_and_trace(file_path):
    trace_data = []
    step_counter = 1

    def trace_calls(frame, event, arg):
        nonlocal step_counter
        
        # We only want to track line-by-line execution, ignoring function calls/returns themselves as separate steps
        if event == 'line':
            # Ensure we are ONLY tracing the target user script and not standard library / third-party modules
            if frame.f_code.co_filename != file_path:
                return trace_calls

            current_locals = sanitize_locals(frame.f_locals)
            
            trace_data.append({
                "step": step_counter,
                "line": frame.f_lineno,
                "locals": current_locals
            })
            step_counter += 1
            
        return trace_calls

    # Read user code
    with open(file_path, "r", encoding="utf-8") as f:
        code_str = f.read()

    # Compile the code to catch syntax errors immediately
    code_obj = compile(code_str, file_path, "exec")

    # Hook into Python's trace engine
    sys.settrace(trace_calls)

    try:
        # Execute the user code within a clean global namespace
        exec(code_obj, {"__name__": "__main__", "__file__": file_path})
    except Exception as e:
        # We catch exceptions gracefully but don't break the trace JSON schema
        trace_data.append({
            "step": step_counter,
            "line": -1,
            "locals": {"ERROR": f"{type(e).__name__}: {str(e)}"}
        })
    finally:
        # Crucial to clean up the tracer to avoid affecting the runner ecosystem
        sys.settrace(None)

    # Output pure JSON to stdout
    print(json.dumps({"success": True, "trace": trace_data}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    target_file = sys.argv[1]
    
    # Switch working dir so relative imports might work
    os.chdir(os.path.dirname(os.path.abspath(target_file)))
    
    execute_and_trace(target_file)
