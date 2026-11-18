from serve import python_env
import subprocess, sys

sys.exit(subprocess.call([python_env(), "-m", "unittest", "discover", "-s", "tests", "-v"]))
