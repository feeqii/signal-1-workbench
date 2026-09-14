"""Lock descriptor 3, inherited from the owning Node process.

POSIX flock follows the shared open-file description across dup/exec. The
parent keeps its descriptor open, so this helper can exit without unlocking.
The kernel releases ownership when the parent closes it or dies. Never unlink
the lock path: every contender must open the same inode.
"""
import fcntl
import sys

try:
    fcntl.flock(3, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    print('This data directory is already open in another Signal-1 process.', file=sys.stderr)
    sys.exit(2)
print('locked', flush=True)
