#!/bin/bash
set -euo pipefail

gradle compileGwt
gradle makeSite