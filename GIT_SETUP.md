# Git & GitHub Setup Guide

## 🚀 **Step 1: VS Code Git Integration Setup**

### **1.1 Install Git (if not already installed)**
```bash
# Check if Git is installed
git --version

# If not installed, download from: https://git-scm.com/downloads
```

### **1.2 Connect VS Code to Your GitHub Account**
1. **Open VS Code**
2. **Install GitHub Extension** (if not installed):
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "GitHub" and install "GitHub" by GitHub

3. **Sign in to GitHub**:
   - Click the Accounts icon in the Activity Bar (left sidebar)
   - Click "Sign in to GitHub"
   - Follow the authentication process

### **1.3 Configure Git (First Time Only)**
```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

## 📁 **Step 2: Working with Your Repository**

### **2.1 Clone Your Repository (if not already cloned)**
```bash
# Replace with your actual repository URL
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name
```

### **2.2 Check Repository Status**
```bash
# Check what files have changed
git status

# See detailed changes
git diff
```

### **2.3 Stage and Commit Changes**
```bash
# Stage all changes
git add .

# Commit with a message
git commit -m "Add simplified CI/CD pipeline with free tier tools"

# Or commit with detailed message
git commit -m "feat: Add cost-effective CI/CD pipeline

- Remove third-party dependencies
- Use GitHub Actions free tier
- Add simplified workflows
- Focus on local development"
```

### **2.4 Push to GitHub**
```bash
# Push to main branch
git push origin main

# Or push to a specific branch
git push origin develop
```

## 🔄 **Step 3: Working with Branches**

### **3.1 Create a New Branch**
```bash
# Create and switch to new branch
git checkout -b feature/cicd-improvements

# Or create branch without switching
git branch feature/cicd-improvements
```

### **3.2 Switch Between Branches**
```bash
# Switch to existing branch
git checkout feature/cicd-improvements

# Switch back to main
git checkout main
```

### **3.3 Merge Branches**
```bash
# Merge feature branch into main
git checkout main
git merge feature/cicd-improvements

# Push merged changes
git push origin main
```

## 🎯 **Step 4: Push Current Changes**

### **4.1 Current Status**
Your project now has:
- ✅ Simplified CI/CD workflows (free tier)
- ✅ All test files created
- ✅ Docker configuration
- ✅ Makefile for local development

### **4.2 Push Commands**
```bash
# 1. Check what's changed
git status

# 2. Stage all new files
git add .

# 3. Commit with descriptive message
git commit -m "feat: Implement cost-effective CI/CD pipeline

- Add simplified GitHub Actions workflows
- Remove third-party dependencies (Codecov, etc.)
- Create comprehensive test suite
- Add Docker configuration for local development
- Focus on free tier tools for MVP phase"

# 4. Push to GitHub
git push origin main
```

## 🔍 **Step 5: Verify GitHub Integration**

### **5.1 Check GitHub Repository**
1. Go to your GitHub repository
2. Verify files are pushed correctly
3. Check Actions tab for workflow runs

### **5.2 Monitor CI/CD Pipeline**
1. Go to "Actions" tab in your repository
2. Watch the workflow runs
3. Check for any failures or issues

## 🛠️ **Step 6: Troubleshooting**

### **6.1 Common Issues**

**Problem**: "Permission denied (publickey)"
```bash
# Solution: Set up SSH key or use personal access token
git remote set-url origin https://github.com/username/repo.git
```

**Problem**: "Please tell me who you are"
```bash
# Solution: Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Problem**: Workflow fails
```bash
# Solution: Check GitHub Actions logs
# Go to Actions tab → Select workflow → View logs
```

## 📞 **Step 7: Get Help**

If you encounter issues:

1. **Check VS Code Git Output**:
   - View → Output
   - Select "Git" from dropdown

2. **Check GitHub Actions Logs**:
   - Go to Actions tab
   - Click on workflow run
   - View detailed logs

3. **Ask for Help**:
   - Share error messages
   - Describe what you're trying to do
   - Mention which step failed

---

## 🎉 **Ready to Push!**

Your project is now ready with:
- ✅ Cost-effective CI/CD pipeline
- ✅ All necessary files created
- ✅ VS Code Git integration ready
- ✅ Comprehensive documentation

Just run the commands in **Step 4.2** to push everything to GitHub and start using your free CI/CD pipeline!