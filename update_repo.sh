#!/bin/bash

# 🚀 Expense Tracker Repository Update Script
# This script will help you update your GitHub repository

echo "🚀 Starting Expense Tracker Repository Update..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Clone the repository
echo -e "${BLUE}Step 1: Cloning your repository...${NC}"
cd ~/Desktop
git clone https://github.com/shubhs7799/Expense-Tracker---Node.js-Project.git
cd Expense-Tracker---Node.js-Project

# Step 2: Create backup branch
echo -e "${BLUE}Step 2: Creating backup branch...${NC}"
git checkout -b backup-original
git push origin backup-original
git checkout main

# Step 3: Copy files from current project
echo -e "${BLUE}Step 3: Copying updated files...${NC}"
echo -e "${YELLOW}Copying files from your current project...${NC}"

# Copy all files from your current project
cp -r /Users/harshalraut/Developer/NodeJs/expense-tracker/* .

# Make sure we don't copy the .git folder
rm -rf .git
git init
git remote add origin https://github.com/shubhs7799/Expense-Tracker---Node.js-Project.git

echo -e "${GREEN}Files copied successfully!${NC}"

# Step 4: Add all changes
echo -e "${BLUE}Step 4: Adding changes to git...${NC}"
git add .

# Step 5: Commit with comprehensive message
echo -e "${BLUE}Step 5: Committing changes...${NC}"
git commit -m "🚀 Major Update: Complete Expense Tracker with Advanced Features

✨ New Features:
- Professional pagination system (5, 10, 20, 50 items per page)
- Password reset functionality with email integration
- Cashfree payment gateway for premium memberships
- User leaderboard and expense reports
- Expense splitting functionality
- Search and filtering capabilities
- Responsive design for all devices

🔧 Technical Improvements:
- Fixed pagination issues and duplicate function conflicts
- Added database transactions for data integrity
- Enhanced JWT authentication and security
- Improved error handling and validation
- Added comprehensive API documentation
- Implemented proper Sequelize associations

📚 Documentation:
- Complete README.md with step-by-step guide
- PROJECT_SUMMARY.md for quick interview reference
- SEQUELIZE_ASSOCIATIONS.md for database concepts
- Added code comments and explanations

🎨 UI/UX Enhancements:
- Modern CSS with custom properties
- Professional color scheme and typography
- Smooth animations and transitions
- Mobile-first responsive design
- Improved user experience and feedback

🧪 Testing & Deployment:
- Added testing commands and strategies
- Deployment guides for Heroku and Railway
- Environment configuration examples
- Production-ready setup instructions

Perfect for technical interviews and portfolio showcase!"

# Step 6: Push to GitHub
echo -e "${BLUE}Step 6: Pushing to GitHub...${NC}"
echo -e "${YELLOW}You'll need to enter your GitHub credentials...${NC}"
git push -u origin main --force

echo -e "${GREEN}✅ Repository update completed successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Your repository has been updated with all improvements!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to https://github.com/shubhs7799/Expense-Tracker---Node.js-Project"
echo "2. Update repository description and topics"
echo "3. Create a new release (v2.0.0)"
echo "4. Review the updated README.md"
echo ""
echo -e "${GREEN}🎉 Your expense tracker is now interview-ready!${NC}"
