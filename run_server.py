"""
ApexScreen AI - Server Launcher
Runs the Flask Backend API & Web Application from the workspace root.
"""
import os
import sys

# Add nested Resume_screening_system to sys.path
nested_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Resume_screening_system")
if nested_dir not in sys.path:
    sys.path.insert(0, nested_dir)

from server import app, run_server

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    run_server(port=port)
