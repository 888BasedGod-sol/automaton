#!/usr/bin/env node
/**
 * Claude Code Review & Improvement System
 * 
 * Uses Claude API to analyze code, find issues, and suggest improvements.
 * Designed to be run periodically or via GitHub Actions.
 * 
 * Usage:
 *   npx tsx scripts/claude-review.ts [--focus=<area>] [--auto-fix]
 * 
 * Environment:
 *   ANTHROPIC_API_KEY - Claude API key (required)
 */

import fs from 'fs';
import path from 'path';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';
const WEB_DIR = path.join(process.cwd(), process.cwd().endsWith('web') ? '' : 'web');

interface ReviewIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'warning' | 'suggestion';
  category: string;
  description: string;
  suggestion?: string;
}

interface ReviewReport {
  timestamp: string;
  focus: string;
  filesAnalyzed: number;
  issues: ReviewIssue[];
  improvements: string[];
  summary: string;
}

// ═══════════════════════════════════════════════════════════
// FILE DISCOVERY
// ═══════════════════════════════════════════════════════════

function findFiles(dir: string, pattern: RegExp, maxDepth = 5): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string, depth: number) {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        // Skip node_modules, .next, etc
        if (entry.isDirectory()) {
          if (['node_modules', '.next', '.vercel', '.git', 'dist'].includes(entry.name)) continue;
          walk(fullPath, depth + 1);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Skip unreadable dirs
    }
  }
  
  walk(dir, 0);
  return files;
}

// ═══════════════════════════════════════════════════════════
// CLAUDE API
// ═══════════════════════════════════════════════════════════

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable required');
  }
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${err}`);
  }
  
  const data = await res.json();
  return data.content[0].text;
}

// ═══════════════════════════════════════════════════════════
// REVIEW PROMPTS
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an expert code reviewer for a Next.js/React/TypeScript web application.
This is AUTOMAGOTCHI - a platform for deploying autonomous AI agents with crypto wallets.

Your job is to analyze code and identify:
1. SECURITY issues (critical) - XSS, injection, auth bypass, exposed secrets
2. PERFORMANCE issues (warning) - N+1 queries, unnecessary re-renders, large bundles
3. ERROR HANDLING issues (warning) - Unhandled promises, missing error boundaries
4. UX issues (suggestion) - Poor loading states, missing feedback, accessibility
5. CODE QUALITY issues (suggestion) - Duplicated code, unclear naming, missing types

Respond in JSON format only:
{
  "issues": [
    {
      "file": "relative/path.tsx",
      "line": 42,
      "severity": "critical|warning|suggestion",
      "category": "security|performance|error-handling|ux|code-quality",
      "description": "What's wrong",
      "suggestion": "How to fix it"
    }
  ],
  "improvements": ["General improvement idea 1", "..."],
  "summary": "Brief overall assessment"
}`;

// ═══════════════════════════════════════════════════════════
// REVIEW TASKS
// ═══════════════════════════════════════════════════════════

async function reviewApiRoutes(): Promise<ReviewIssue[]> {
  console.log('📡 Analyzing API routes...');
  
  const apiFiles = findFiles(path.join(WEB_DIR, 'app/api'), /route\.ts$/);
  const issues: ReviewIssue[] = [];
  
  // Batch files to avoid token limits
  const batchSize = 5;
  for (let i = 0; i < apiFiles.length; i += batchSize) {
    const batch = apiFiles.slice(i, i + batchSize);
    const contents = batch.map(f => {
      const content = fs.readFileSync(f, 'utf-8');
      const relPath = path.relative(WEB_DIR, f);
      return `--- FILE: ${relPath} ---\n${content.slice(0, 3000)}\n`;
    }).join('\n');
    
    const prompt = `Review these Next.js API routes for security, error handling, and performance issues:\n\n${contents}`;
    
    try {
      const response = await callClaude(SYSTEM_PROMPT, prompt);
      const parsed = JSON.parse(response);
      issues.push(...(parsed.issues || []));
    } catch (e: any) {
      console.error(`  ⚠️ Error reviewing batch: ${e.message}`);
    }
  }
  
  return issues;
}

async function reviewComponents(): Promise<ReviewIssue[]> {
  console.log('🧩 Analyzing React components...');
  
  const componentFiles = findFiles(path.join(WEB_DIR, 'components'), /\.tsx$/);
  const issues: ReviewIssue[] = [];
  
  const contents = componentFiles.map(f => {
    const content = fs.readFileSync(f, 'utf-8');
    const relPath = path.relative(WEB_DIR, f);
    return `--- FILE: ${relPath} ---\n${content.slice(0, 2500)}\n`;
  }).join('\n');
  
  const prompt = `Review these React components for performance, accessibility, and UX issues:\n\n${contents}`;
  
  try {
    const response = await callClaude(SYSTEM_PROMPT, prompt);
    const parsed = JSON.parse(response);
    issues.push(...(parsed.issues || []));
  } catch (e: any) {
    console.error(`  ⚠️ Error reviewing components: ${e.message}`);
  }
  
  return issues;
}

async function reviewPages(): Promise<ReviewIssue[]> {
  console.log('📄 Analyzing pages...');
  
  const pageFiles = findFiles(path.join(WEB_DIR, 'app'), /page\.tsx$/);
  const issues: ReviewIssue[] = [];
  
  // Just review key pages
  const keyPages = pageFiles.slice(0, 5);
  
  for (const file of keyPages) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(WEB_DIR, file);
    
    const prompt = `Review this Next.js page for performance, SEO, and UX issues:\n\n--- FILE: ${relPath} ---\n${content.slice(0, 4000)}`;
    
    try {
      const response = await callClaude(SYSTEM_PROMPT, prompt);
      const parsed = JSON.parse(response);
      issues.push(...(parsed.issues || []));
    } catch (e: any) {
      console.error(`  ⚠️ Error reviewing ${relPath}: ${e.message}`);
    }
  }
  
  return issues;
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('\n🤖 CLAUDE CODE REVIEW SYSTEM');
  console.log('═'.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Web Dir: ${WEB_DIR}`);
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.log('\nSet it with:');
    console.log('  export ANTHROPIC_API_KEY=your-key-here\n');
    process.exit(1);
  }
  
  const args = process.argv.slice(2);
  const focus = args.find(a => a.startsWith('--focus='))?.split('=')[1] || 'all';
  
  const allIssues: ReviewIssue[] = [];
  const allImprovements: string[] = [];
  
  // Run reviews based on focus
  if (focus === 'all' || focus === 'api') {
    allIssues.push(...await reviewApiRoutes());
  }
  
  if (focus === 'all' || focus === 'components') {
    allIssues.push(...await reviewComponents());
  }
  
  if (focus === 'all' || focus === 'pages') {
    allIssues.push(...await reviewPages());
  }
  
  // ═══════════════════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════════════════
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 REVIEW RESULTS');
  console.log('═'.repeat(60) + '\n');
  
  const critical = allIssues.filter(i => i.severity === 'critical');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const suggestions = allIssues.filter(i => i.severity === 'suggestion');
  
  if (critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES:');
    for (const issue of critical) {
      console.log(`\n  ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`  └─ ${issue.description}`);
      if (issue.suggestion) {
        console.log(`  └─ Fix: ${issue.suggestion}`);
      }
    }
  }
  
  if (warnings.length > 0) {
    console.log('\n🟡 WARNINGS:');
    for (const issue of warnings) {
      console.log(`  ${issue.file}: ${issue.description}`);
    }
  }
  
  if (suggestions.length > 0) {
    console.log('\n🔵 SUGGESTIONS:');
    for (const issue of suggestions.slice(0, 10)) {
      console.log(`  ${issue.file}: ${issue.description}`);
    }
    if (suggestions.length > 10) {
      console.log(`  ... and ${suggestions.length - 10} more suggestions`);
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${allIssues.length} issues`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟡 Warnings: ${warnings.length}`);
  console.log(`  🔵 Suggestions: ${suggestions.length}`);
  console.log('─'.repeat(60) + '\n');
  
  // Save report
  const report: ReviewReport = {
    timestamp: new Date().toISOString(),
    focus,
    filesAnalyzed: allIssues.length,
    issues: allIssues,
    improvements: allImprovements,
    summary: `Found ${critical.length} critical, ${warnings.length} warnings, ${suggestions.length} suggestions`,
  };
  
  const reportPath = path.join(WEB_DIR, 'review-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}`);
  
  // Exit with error if critical issues
  process.exit(critical.length > 0 ? 1 : 0);
}

main().catch(console.error);
