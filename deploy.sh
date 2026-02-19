#!/bin/bash
# Usage:
#   ./deploy.sh        → deploy bot only
#   ./deploy.sh full   → deploy bot + build + restart dashboard

VPS="root@31.97.160.106"
REMOTE="/root/emilybot"

echo "→ syncing files..."
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='.git' \
  --exclude='dashboard/.next' --exclude='dashboard/node_modules' \
  ./ $VPS:$REMOTE/

echo "→ restarting bot..."
ssh $VPS "cd $REMOTE && pm2 restart emilybot"

if [ "$1" == "full" ]; then
  echo "→ building dashboard..."
  ssh $VPS "cd $REMOTE/dashboard && npm install && npm run build && pm2 restart dashboard"
fi

echo "✓ done"
