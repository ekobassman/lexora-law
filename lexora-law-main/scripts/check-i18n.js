#!/usr/bin/env node
/**
 * i18n Compliance Checker
 * Compares all locale files against EN (reference) and reports missing keys.
 * Exit code 1 if any missing keys found.
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const REFERENCE_LOCALE = 'en';

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadLocale(filename) {
  const filePath = path.join(LOCALES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

// Expected locales (11 total)
const EXPECTED_LOCALES = ['de', 'en', 'it', 'fr', 'es', 'tr', 'ro', 'pl', 'ru', 'uk', 'ar'];

function main() {
  const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
  const foundLocales = files.map(f => f.replace('.json', ''));
  
  // Check for missing locale files
  const missingLocales = EXPECTED_LOCALES.filter(l => !foundLocales.includes(l));
  if (missingLocales.length > 0) {
    console.log(`⚠️ Missing locale files: ${missingLocales.join(', ')}`);
  }
  
  // Load reference locale (EN)
  const refData = loadLocale(`${REFERENCE_LOCALE}.json`);
  const refKeys = getAllKeys(refData);
  
  console.log(`📋 Reference locale: ${REFERENCE_LOCALE}.json (${refKeys.length} keys)`);
  console.log(`📁 Total locales found: ${files.length} (expected: ${EXPECTED_LOCALES.length})\n`);
  
  let totalMissing = 0;
  const report = {};
  
  for (const file of files) {
    const locale = file.replace('.json', '');
    if (locale === REFERENCE_LOCALE) continue;
    
    const data = loadLocale(file);
    const keys = getAllKeys(data);
    
    const missingKeys = refKeys.filter(k => !keys.includes(k));
    const extraKeys = keys.filter(k => !refKeys.includes(k));
    
    report[locale] = {
      totalKeys: keys.length,
      missingKeys,
      extraKeys
    };
    
    totalMissing += missingKeys.length;
  }
  
  // Print report
  console.log('═══════════════════════════════════════════════════════');
  console.log('                  i18n COMPLIANCE REPORT                ');
  console.log('═══════════════════════════════════════════════════════\n');
  
  for (const [locale, data] of Object.entries(report)) {
    const status = data.missingKeys.length === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${locale.toUpperCase()}: ${data.totalKeys}/${refKeys.length} keys`);
    
    if (data.missingKeys.length > 0) {
      console.log(`   Missing (${data.missingKeys.length}):`);
      data.missingKeys.forEach(k => console.log(`     - ${k}`));
    }
    if (data.extraKeys.length > 0) {
      console.log(`   Extra (${data.extraKeys.length}):`);
      data.extraKeys.slice(0, 5).forEach(k => console.log(`     + ${k}`));
      if (data.extraKeys.length > 5) {
        console.log(`     ... and ${data.extraKeys.length - 5} more`);
      }
    }
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`TOTAL: ${Object.keys(report).length} locales checked`);
  console.log(`MISSING KEYS: ${totalMissing}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  if (totalMissing > 0) {
    console.log('❌ i18n compliance check FAILED\n');
    process.exit(1);
  } else {
    console.log('✅ All locales are compliant!\n');
    process.exit(0);
  }
}

main();
