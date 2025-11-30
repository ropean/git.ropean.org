#!/bin/bash
#
# Integration test script for Mirror Proxy
#
# Usage: ./test/mirror-test.sh [local|remote]
#   local  - Test against local wrangler dev server (default: http://localhost:8787)
#   remote - Test against source site directly (https://ropean.github.io)
#

set -e

SOURCE_ORIGIN="https://ropean.github.io"
LOCAL_URL="http://localhost:8787"

MODE="${1:-remote}"
if [ "$MODE" = "local" ]; then
  BASE_URL="$LOCAL_URL"
else
  BASE_URL="$SOURCE_ORIGIN"
fi

echo ""
echo "=== Mirror Proxy Integration Test ==="
echo "Mode: $MODE"
echo "Base URL: $BASE_URL"
echo ""

PASSED=0
FAILED=0

test_request() {
  local path="$1"
  local description="$2"
  local url="${BASE_URL}${path}"

  echo "[TEST] $description"
  echo "  URL: $url"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  CONTENT_TYPE=$(curl -s -I "$url" 2>/dev/null | grep -i "content-type" | cut -d: -f2 | tr -d ' \r\n' || echo "N/A")

  echo "  Status: $HTTP_CODE"
  echo "  Content-Type: $CONTENT_TYPE"

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "  ✅ PASSED"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

# Run tests
test_request "/" "Homepage"
test_request "/index.html" "Index HTML"
test_request "/assets/index.js" "JavaScript asset"
test_request "/assets/style.css" "CSS asset"
test_request "/favicon.ico" "Favicon"

TOTAL=$((PASSED + FAILED))

echo "=== Test Summary ==="
echo "Passed: $PASSED/$TOTAL"
echo "Failed: $FAILED/$TOTAL"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "⚠️  Some tests failed. Check the output above."
  exit 1
else
  echo ""
  echo "✅ All tests passed!"
  exit 0
fi
