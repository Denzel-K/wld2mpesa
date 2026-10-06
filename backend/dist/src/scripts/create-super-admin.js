#!/usr/bin/env tsx
"use strict";
/**
 * create-super-admin.ts — CLI script to create a super admin
 *
 * Usage:
 *   npm run create-super-admin
 *
 * This script creates the first super-admin account for the admin panel.
 * Super-admins can then invite other managers through the admin panel.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const prisma_1 = require("../db/prisma");
const adminService_1 = require("../services/adminService");
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => resolve(answer.trim()));
    });
}
async function validatePassword(password) {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return 'Password must contain at least one special character';
    }
    return null;
}
async function main() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     WLD2Mpesa — Create Super Admin Account             ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    try {
        // Collect information
        const fullName = await question('Full Name: ');
        if (!fullName) {
            console.error('Error: Full name is required');
            process.exit(1);
        }
        const email = await question('Email Address: ');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.error('Error: Valid email address is required');
            process.exit(1);
        }
        // Check if email already exists
        const existing = await (0, adminService_1.findAdminByEmail)(email);
        if (existing) {
            console.error(`Error: An admin with email ${email} already exists`);
            process.exit(1);
        }
        const phone = await question('Phone Number (optional): ');
        // Password with confirmation
        let password;
        let confirmPassword;
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            password = await question('Password: ');
            const validationError = await validatePassword(password);
            if (validationError) {
                console.log(`\n❌ ${validationError}`);
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`Please try again (${maxAttempts - attempts} attempts remaining):\n`);
                    continue;
                }
                else {
                    console.error('\nError: Maximum attempts exceeded');
                    process.exit(1);
                }
            }
            confirmPassword = await question('Confirm Password: ');
            if (password !== confirmPassword) {
                console.log('\n❌ Passwords do not match');
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`Please try again (${maxAttempts - attempts} attempts remaining):\n`);
                    continue;
                }
                else {
                    console.error('\nError: Maximum attempts exceeded');
                    process.exit(1);
                }
            }
            break;
        }
        if (!password) {
            console.error('\nError: Password is required');
            process.exit(1);
        }
        // Confirmation
        console.log('\n┌────────────────────────────────────────────────────────┐');
        console.log('│              Review Account Details                    │');
        console.log('├────────────────────────────────────────────────────────┤');
        console.log(`│ Full Name:    ${fullName.padEnd(40)}│`);
        console.log(`│ Email:        ${email.padEnd(40)}│`);
        console.log(`│ Phone:        ${(phone || 'N/A').padEnd(40)}│`);
        console.log(`│ Role:         ${'SUPER_ADMIN'.padEnd(40)}│`);
        console.log('└────────────────────────────────────────────────────────┘\n');
        const confirm = await question('Create this super admin account? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
            console.log('\nOperation cancelled.');
            process.exit(0);
        }
        // Create the super admin
        const admin = await (0, adminService_1.createAdmin)({
            fullName,
            email,
            phone: phone || undefined,
            password,
            role: 'SUPER_ADMIN',
        });
        console.log('\n✅ Super admin created successfully!\n');
        console.log('Account Details:');
        console.log(`  ID:    ${admin.id}`);
        console.log(`  Name:  ${admin.fullName}`);
        console.log(`  Email: ${admin.email}`);
        console.log(`  Role:  ${admin.role}`);
        console.log(`  Status: ${admin.status}`);
        console.log('\nYou can now log in at: /admin-panel\n');
    }
    catch (error) {
        console.error('\n❌ Error creating super admin:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        rl.close();
        await prisma_1.prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=create-super-admin.js.map