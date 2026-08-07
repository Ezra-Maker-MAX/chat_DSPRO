"""
Push local changes to GitHub via the Git Data API (bypasses blocked git:// over 443).

Usage:
  GH_TOKEN=<token> python scripts/gh_push.py "commit message"

By default it pushes every locally modified/untracked file that is NOT in
.gitignore, plus respects GH_FILES env var (colon-separated paths) to limit scope.
Run from the repo root.
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error

TOKEN = os.environ.get('GH_TOKEN', '') or os.environ.get('GITHUB_TOKEN', '')
if not TOKEN:
    raise SystemExit('Set GH_TOKEN env var first')
REPO = os.environ.get('GH_REPO', 'Ezra-Maker-MAX/chat_DSPRO')
BASE = f'https://api.github.com/repos/{REPO}'
HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}

RETRIES = 4

def api(method, path, body=None):
    """Call the GitHub API with retries on transient network/5xx failures.

    The sandbox network to api.github.com is occasionally flaky; without retries
    a single dropped connection aborts the whole push halfway through.
    """
    last_err = None
    for attempt in range(1, RETRIES + 1):
        req = urllib.request.Request(
            BASE + path,
            data=json.dumps(body).encode() if body is not None else None,
            method=method,
            headers=HEADERS,
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.status, json.load(resp)
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:300]
            # 4xx (except 429) are deterministic — no point retrying
            if e.code < 500 and e.code != 429:
                print(f'HTTPError {e.code} on {method} {path}: {detail}', file=sys.stderr)
                raise
            last_err = f'HTTP {e.code}: {detail}'
        except Exception as e:  # URLError, timeout, connection reset, ...
            last_err = f'{type(e).__name__}: {e}'
        if attempt < RETRIES:
            wait = 2 ** attempt
            print(f'  ! {method} {path} failed ({last_err}); retry {attempt}/{RETRIES - 1} in {wait}s', file=sys.stderr)
            time.sleep(wait)
    raise SystemExit(f'API call failed after {RETRIES} attempts: {method} {path} -> {last_err}')

def get_changed_files():
    """Return list of repo-relative paths with local modifications (tracked + untracked).
    Untracked directories (reported as 'dir/') are expanded into their contained files."""
    files = set()
    out = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if not line.strip():
            continue
        status = line[:2]
        path = line[3:].strip()
        if path.startswith('"'):
            path = path.strip('"')
        # Skip deletions (D) since remote still has the file; skip submodules etc.
        if status.startswith('D'):
            continue
        # Expand untracked directories into individual files
        if path.endswith('/') and os.path.isdir(path):
            for root, dirs, filenames in os.walk(path):
                dirs[:] = [d for d in dirs if d != '.git']
                for name in filenames:
                    rel = os.path.join(root, name).replace('\\', '/')
                    files.add(rel)
            continue
        files.add(path)
    # Limit scope if GH_FILES provided
    scope = os.environ.get('GH_FILES', '')
    if scope:
        allowed = {p for p in scope.split(':') if p}
        files = {p for p in files if p in allowed}
    return sorted(files)

def main():
    if len(sys.argv) < 2:
        raise SystemExit('Usage: GH_TOKEN=<token> python scripts/gh_push.py "commit message"')
    commit_msg = sys.argv[1]
    files = get_changed_files()
    if not files:
        print('No files to push (working tree clean or all changes filtered out).')
        return

    # 1. Current commit + tree
    _, ref = api('GET', '/git/ref/heads/main')
    head_sha = ref['object']['sha']
    _, commit = api('GET', f'/git/commits/{head_sha}')
    base_tree = commit['tree']['sha']
    print('base commit:', head_sha)

    # 2. Create blobs
    tree_items = []
    for path in files:
        with open(path, 'rb') as f:
            content = f.read()
        b64 = base64.b64encode(content).decode()
        _, blob = api('POST', '/git/blobs', {'content': b64, 'encoding': 'base64'})
        tree_items.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
        print('  push', path, '->', blob['sha'][:8])

    # 3. Create tree (base_tree preserves everything else)
    _, new_tree = api('POST', '/git/trees', {'base_tree': base_tree, 'tree': tree_items})

    # 4. Create commit
    _, new_commit = api('POST', '/git/commits', {'message': commit_msg, 'tree': new_tree['sha'], 'parents': [head_sha]})

    # 5. Update ref
    _, upd = api('PATCH', '/git/refs/heads/main', {'sha': new_commit['sha'], 'force': False})
    print('pushed:', new_commit['sha'])
    print('ref ->', upd['object']['sha'])
    print('DONE')

if __name__ == '__main__':
    main()
